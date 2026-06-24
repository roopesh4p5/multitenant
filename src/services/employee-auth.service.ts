import { sequelize } from '../config/dbconfig';
import {
  User,
  UserStatus,
  EmployeeProfile,
  Organization,
  DynamicField,
  DynamicFieldType,
  FieldValue,
} from '../models';
import { hashPassword, verifyPassword } from '../utils/password.util';
import { signToken } from '../utils/jwt.util';
import {
  validateEmployeeData,
  coerceFieldValue,
} from './schema-validator.service';

export interface EmployeeSignupDto {
  email: string;
  password: string;
  name: string;
  phone?: string;
  fieldValues: Record<string, any>;
}

export interface EmployeeLoginDto {
  email: string;
  password: string;
}


export const signupEmployee = async (dto: EmployeeSignupDto, tenantId: string) => {
  const { email, password, name, phone, fieldValues } = dto;

  // Verify tenant exists and is active
  const tenant = await Organization.findOne({
    where: { tenant_id: tenantId },
  });

  if (!tenant) {
    throw new Error('TENANT_NOT_FOUND');
  }

  if (tenant.status !== 'active') {
    throw new Error('TENANT_NOT_ACTIVE');
  }

  // Check email uniqueness within tenant
  const existingEmployee = await User.findOne({
    where: {
      tenant_id: tenantId,
      email,
    },
  });

  if (existingEmployee) {
    throw new Error('EMAIL_TAKEN_IN_TENANT');
  }

  if (!fieldValues || typeof fieldValues !== 'object' || Array.isArray(fieldValues)) {
    const err = new Error('INVALID_FIELD_VALUES');
    throw err;
  }

  const validationResult = await validateEmployeeData(fieldValues, tenantId);
  if (!validationResult.valid) {
    const err = new Error('SCHEMA_VALIDATION_FAILED') as Error & { validationErrors?: any };
    err.validationErrors = validationResult.errors;
    throw err;
  }

  const password_hash = await hashPassword(password);

  const result = await sequelize.transaction(async (t) => {
    // Create user with ACTIVE status (no admin approval required)
    const user = await User.create(
      {
        tenant_id: tenantId,
        email,
        password_hash,
        name,
        phone: phone || null,
        status: UserStatus.ACTIVE,
        role_id: null, // Employee has no role initially
      },
      { transaction: t }
    );

    // Create associated employee profile
    const profile = await EmployeeProfile.create(
      {
        user_id: user.id,
        tenant_id: tenantId,
        approved_by: null,
        approved_at: new Date(), // mark approved immediately
      },
      { transaction: t }
    );

    const schemaFields = await DynamicField.findAll({
      where: {
        tenant_id: tenantId,
        active: true,
      },
      transaction: t,
    });

    const fieldMap = new Map(schemaFields.map((field) => [field.field_name, field]));

    for (const [fieldName, value] of Object.entries(fieldValues)) {
      const schemaField = fieldMap.get(fieldName);
      if (!schemaField) {
        throw new Error(`UNKNOWN_SCHEMA_FIELD:${fieldName}`);
      }
      if (value === undefined || value === null || value === '') {
        continue;
      }

      await FieldValue.create(
        {
          employee_id: profile.id,
          field_id: schemaField.id,
          value: coerceFieldValue(schemaField.field_type, value),
        },
        { transaction: t }
      );
    }

    return {
      user_id: user.id,
      profile_id: profile.id,
      email: user.email,
      name: user.name,
      status: user.status,
      created_at: user.created_at,
    };
  });

  return result;
};

/**
 * Employee login — authenticates an employee and returns JWT token.
 *
 * Flow:
 * 1. Find employee by email within tenant
 * 2. Verify password
 * 3. Check employee status (must be ACTIVE)
 * 4. Check profile is approved
 * 5. Issue JWT token
 */
export const loginEmployee = async (
  dto: EmployeeLoginDto,
  tenantId: string
) => {
  const { email, password } = dto;

  const user = await User.findOne({
    where: {
      tenant_id: tenantId,
      email,
    },
  });

  if (!user) {
    throw new Error('INVALID_CREDENTIALS');
  }

  const isPasswordValid = await verifyPassword(password, user.password_hash);
  if (!isPasswordValid) {
    throw new Error('INVALID_CREDENTIALS');
  }

  // Ensure user exists and password is valid. Approval and status are handled at creation.
  if (user.status !== UserStatus.ACTIVE) {
    throw new Error('USER_NOT_ACTIVE');
  }

  // Generate JWT token
  const token = signToken({
    userId: user.id,
    tenantId: user.tenant_id,
    roleId: user.role_id || null,
    email: user.email,
    isSuperAdmin: false,
  });

  return {
    token,
    user: {
      user_id: Number(user.id),
      email: user.email,
      name: user.name,
      phone: user.phone,
      tenant_id: tenantId,
    },
  };
};

/**
 * Get employee profile with field values.
 * Validates that user belongs to the tenant making the request.
 */
const parseFieldValue = (
  fieldType: DynamicFieldType,
  storedValue: string,
  validationRules: any
): any => {
  if (fieldType === DynamicFieldType.GROUP) {
    try {
      return JSON.parse(storedValue);
    } catch {
      return storedValue;
    }
  }

  if (fieldType === DynamicFieldType.NUMBER) {
    const num = Number(storedValue);
    return Number.isNaN(num) ? storedValue : num;
  }

  if (fieldType === DynamicFieldType.DROPDOWN && validationRules?.allowMultiple) {
    return storedValue.split(',').map((value) => value.trim());
  }

  return storedValue;
};

export const getEmployeeProfile = async (
  employeeId: number,
  tenantId: string
) => {
  const user = await User.findOne({
    where: {
      id: employeeId,
      tenant_id: tenantId,
    },
  });

  if (!user) {
    throw new Error('EMPLOYEE_NOT_FOUND');
  }

  const profile = await EmployeeProfile.findOne({
    where: {
      user_id: employeeId,
      tenant_id: tenantId,
    },
  });

  if (!profile) {
    throw new Error('PROFILE_NOT_FOUND');
  }

  const values = await FieldValue.findAll({
    where: { employee_id: profile.id },
    include: [
      {
        model: DynamicField,
        as: 'field',
        attributes: ['field_name', 'field_type', 'validation_rules'],
      },
    ],
  });

  const fieldValues = values.reduce<Record<string, any>>((acc, item: any) => {
    if (!item.field) {
      return acc;
    }
    acc[item.field.field_name] = parseFieldValue(
      item.field.field_type,
      item.value,
      item.field.validation_rules
    );
    return acc;
  }, {});

  return {
    user_id: user.id,
    profile_id: profile.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    status: user.status,
    approved: profile.approved_at !== null,
    approved_at: profile.approved_at,
    created_at: user.created_at,
    updated_at: user.updated_at,
    fieldValues,
  };
};

/**
 * Update employee profile (personal info only).
 * Does not update schema fields — use schema API for that.
 */
export const updateEmployeeProfile = async (
  employeeId: number,
  tenantId: string,
  updates: { name?: string; phone?: string }
) => {
  const user = await User.findOne({
    where: {
      id: employeeId,
      tenant_id: tenantId,
    },
  });

  if (!user) {
    throw new Error('EMPLOYEE_NOT_FOUND');
  }

  const updated = await user.update(updates);

  return {
    user_id: updated.id,
    email: updated.email,
    name: updated.name,
    phone: updated.phone,
    updated_at: updated.updated_at,
  };
};
