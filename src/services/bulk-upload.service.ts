import { v4 as uuidv4 } from 'uuid';
import * as xlsx from 'xlsx';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { sequelize } from '../config/dbconfig';
import {
  User,
  EmployeeProfile,
  FieldValue,
  DynamicField,
  UserStatus,
} from '../models';
import { hashPassword } from '../utils/password.util';
import { validateEmployeeData, coerceFieldValue } from './schema-validator.service';

export interface BulkUploadResult {
  totalRows: number;
  successCount: number;
  errorCount: number;
  errorReportId: string | null;
}

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

// trim keys and text values from the row
const sanitizeRow = (row: any): Record<string, any> => {
  const sanitized: Record<string, any> = {};
  for (const [key, val] of Object.entries(row)) {
    const trimmedKey = String(key).trim();
    sanitized[trimmedKey] = typeof val === 'string' ? val.trim() : val;
  }
  return sanitized;
};

// build nested objects from dot keys like contact.phone
const reconstructNestedObjects = (row: Record<string, any>): Record<string, any> => {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(row)) {
    if (value === undefined || value === null || value === '') {
      continue;
    }
    const parts = key.split('.');
    let current = result;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (i === parts.length - 1) {
        current[part] = value;
      } else {
        if (!current[part] || typeof current[part] !== 'object') {
          current[part] = {};
        }
        current = current[part];
      }
    }
  }
  return result;
};

export const processBulkUpload = async (
  fileBuffer: Buffer,
  tenantId: string
): Promise<BulkUploadResult> => {
  const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('Excel workbook contains no sheets');
  }

  const sheet = workbook.Sheets[sheetName];
  const rawRows = xlsx.utils.sheet_to_json<any>(sheet, { defval: '' });

  const totalRows = rawRows.length;
  console.log('[processBulkUpload] got rows', totalRows, 'tenant', tenantId);
  let successCount = 0;
  let errorCount = 0;

  const activeFields = await DynamicField.findAll({
    where: {
      tenant_id: tenantId,
      active: true,
    },
  });
  console.log('[processBulkUpload] active fields', activeFields.length);

  const baseFields = ['name', 'email', 'password', 'phone'];
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const processedEmails = new Set<string>();

  const invalidRowsWithErrors: any[] = [];
  const validationErrorsMap = new Map<number, string[]>();

  for (let index = 0; index < rawRows.length; index++) {
    const rawRow = rawRows[index];
    const sanitized = sanitizeRow(rawRow);
    const reconstructed = reconstructNestedObjects(sanitized);

    const name = reconstructed.name;
    const email = reconstructed.email;
    const password = reconstructed.password || 'Welcome123!'; // Default password if empty
    const phone = reconstructed.phone;

    const errors: string[] = [];

    // 1. Base validations
    if (!name) {
      errors.push('name is required');
    }
    if (!email) {
      errors.push('email is required');
    } else if (!emailRegex.test(email)) {
      errors.push('Invalid email format');
    } else {
      const emailLower = email.toLowerCase();
      if (processedEmails.has(emailLower)) {
        errors.push(`Duplicate email "${email}" in the same upload batch`);
      } else {
        processedEmails.add(emailLower);
        // Check uniqueness in database within this tenant
        const existingUser = await User.findOne({
          where: { tenant_id: tenantId, email: emailLower },
        });
        if (existingUser) {
          errors.push(`Email "${email}" is already registered in this organization`);
        }
      }
    }

    if (password && password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    // Extract dynamic fields (remove base fields from reconstructed object)
    const fieldValues: Record<string, any> = {};
    for (const [key, val] of Object.entries(reconstructed)) {
      if (!baseFields.includes(key) && key !== 'Errors') {
        fieldValues[key] = val;
      }
    }

    try {
      const schemaValidation = await validateEmployeeData(fieldValues, tenantId);
      if (!schemaValidation.valid) {
        for (const err of schemaValidation.errors) {
          errors.push(`${err.field_name}: ${err.error}`);
        }
      }
    } catch (err: any) {
      errors.push(`Schema validation failed: ${err.message}`);
    }

    if (errors.length > 0) {
      errorCount++;
      validationErrorsMap.set(index, errors);
      invalidRowsWithErrors.push({
        ...rawRow,
        Errors: errors.join('; '),
      });
      continue;
    }

    // 3. Save valid employee record inside a database transaction
    try {
      const passwordHash = await hashPassword(password);
      await sequelize.transaction(async (t) => {
        const user = await User.create(
          {
            tenant_id: tenantId,
            email: email.toLowerCase(),
            password_hash: passwordHash,
            name,
            phone: phone || null,
            status: UserStatus.ACTIVE,
            role_id: null,
          },
          { transaction: t }
        );

        const profile = await EmployeeProfile.create(
          {
            user_id: user.id,
            tenant_id: tenantId,
            approved_by: null,
            approved_at: new Date(),
          },
          { transaction: t }
        );

        // Write FieldValues
        for (const field of activeFields) {
          const val = fieldValues[field.field_name];
          if (val !== undefined && val !== null && val !== '') {
            const coerced = coerceFieldValue(field.field_type, val);
            await FieldValue.create(
              {
                employee_id: profile.id,
                field_id: field.id,
                value: coerced,
              },
              { transaction: t }
            );
          }
        }
      });
      successCount++;
    } catch (err: any) {
      errorCount++;
      const dbErrMessage = `Database saving failed: ${err.message}`;
      validationErrorsMap.set(index, [dbErrMessage]);
      invalidRowsWithErrors.push({
        ...rawRow,
        Errors: dbErrMessage,
      });
    }
  }

  // 4. Generate and upload error report to S3 if there are failed rows
  let errorReportId: string | null = null;
  if (errorCount > 0) {
    errorReportId = uuidv4();
    console.log('[processBulkUpload] uploading error report', errorReportId);
    const reportRows = rawRows.map((rawRow, index) => {
      const rowErrors = validationErrorsMap.get(index);
      return {
        ...rawRow,
        Errors: rowErrors ? rowErrors.join('; ') : 'Valid (Created)',
      };
    });

    const reportSheet = xlsx.utils.json_to_sheet(reportRows);
    const reportWorkbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(reportWorkbook, reportSheet, 'Bulk Upload Errors');

    const reportBuffer = xlsx.write(reportWorkbook, { type: 'buffer', bookType: 'xlsx' });
    const s3Key = `error-reports/${errorReportId}.xlsx`;

    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET_NAME || '',
        Key: s3Key,
        Body: reportBuffer,
        ContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
    );
    console.log('[processBulkUpload] uploaded error report to s3', s3Key);
  }

  console.log('[processBulkUpload] finished', {
    totalRows,
    successCount,
    errorCount,
    errorReportId,
  });

  return {
    totalRows,
    successCount,
    errorCount,
    errorReportId,
  };
};

export const getErrorReportStream = async (reportId: string): Promise<any> => {
  const s3Key = `error-reports/${reportId}.xlsx`;
  try {
    const response = await s3.send(
      new GetObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET_NAME || '',
        Key: s3Key,
      })
    );
    if (!response.Body) {
      throw new Error('REPORT_NOT_FOUND');
    }
    return response.Body;
  } catch (err: any) {
    if (err.name === 'NoSuchKey' || err.Code === 'NoSuchKey') {
      throw new Error('REPORT_NOT_FOUND');
    }
    throw err;
  }
};
