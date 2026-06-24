import { UniqueConstraintError, Op } from 'sequelize';
import { sequelize } from '../config/dbconfig';
import {
  DynamicField,
  DynamicFieldType,
  GroupFieldDefinition,
  ValidationRules,
} from '../models';

export interface SchemaFieldDto {
  field_name?: string;
  field_type?: DynamicFieldType;
  required?: boolean;
  display_order?: number;
  active?: boolean;
  validation_rules?: ValidationRules | null;
}

const fieldTypes = new Set<string>(Object.values(DynamicFieldType));

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const assertStringArray = (value: unknown, fieldName: string): void => {
  if (value === undefined) return;
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`${fieldName} must be an array of strings`);
  }
};

const assertNumber = (value: unknown, fieldName: string): void => {
  if (value === undefined) return;
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error(`${fieldName} must be a number`);
  }
};

const assertInteger = (value: unknown, fieldName: string): void => {
  if (value === undefined) return;
  if (!Number.isInteger(value)) {
    throw new Error(`${fieldName} must be an integer`);
  }
};

const validateCommonDto = (dto: SchemaFieldDto): void => {
  if (dto.required !== undefined && typeof dto.required !== 'boolean') {
    throw new Error('required must be a boolean');
  }

  if (dto.active !== undefined && typeof dto.active !== 'boolean') {
    throw new Error('active must be a boolean');
  }

  assertInteger(dto.display_order, 'display_order');
};

const validateGroupFields = (
  fields: unknown,
  path = 'validation_rules.fields',
  depth = 0
): void => {
  if (!Array.isArray(fields) || fields.length === 0) {
    throw new Error(`${path} must be a non-empty array`);
  }

  if (depth > 10) {
    throw new Error('group nesting cannot exceed 10 levels');
  }

  fields.forEach((field, index) => {
    if (!isPlainObject(field)) {
      throw new Error(`${path}[${index}] must be an object`);
    }

    if (typeof field.field_name !== 'string' || !field.field_name.trim()) {
      throw new Error(`${path}[${index}].field_name is required`);
    }

    if (typeof field.field_type !== 'string' || !fieldTypes.has(field.field_type)) {
      throw new Error(`${path}[${index}].field_type is invalid`);
    }

    if (field.required !== undefined && typeof field.required !== 'boolean') {
      throw new Error(`${path}[${index}].required must be a boolean`);
    }

    if (
      field.validation_rules !== undefined &&
      field.validation_rules !== null &&
      !isPlainObject(field.validation_rules)
    ) {
      throw new Error(`${path}[${index}].validation_rules must be an object`);
    }

    if (field.field_type === DynamicFieldType.GROUP) {
      const nestedRules = field.validation_rules as ValidationRules | undefined;
      const nestedField = field as unknown as GroupFieldDefinition;
      validateGroupFields(
        nestedRules?.fields ?? nestedField.fields,
        `${path}[${index}].validation_rules.fields`,
        depth + 1
      );
    }
  });
};

const validateRulesForType = (
  fieldType: DynamicFieldType,
  validationRules: ValidationRules | null | undefined
): void => {
  if (validationRules === undefined || validationRules === null) return;
  if (!isPlainObject(validationRules)) {
    throw new Error('validation_rules must be an object');
  }
  const rules = validationRules as ValidationRules;

  switch (fieldType) {
    case DynamicFieldType.TEXT:
      assertInteger(rules.minLength, 'validation_rules.minLength');
      assertInteger(rules.maxLength, 'validation_rules.maxLength');
      break;
    case DynamicFieldType.NUMBER:
      assertNumber(rules.min, 'validation_rules.min');
      assertNumber(rules.max, 'validation_rules.max');
      if (
        rules.integer !== undefined &&
        typeof rules.integer !== 'boolean'
      ) {
        throw new Error('validation_rules.integer must be a boolean');
      }
      break;
    case DynamicFieldType.PHONE:
      assertInteger(rules.minLength, 'validation_rules.minLength');
      assertInteger(rules.maxLength, 'validation_rules.maxLength');
      break;
    case DynamicFieldType.EMAIL:
      assertStringArray(rules.allowedDomains, 'validation_rules.allowedDomains');
      assertStringArray(rules.blockedDomains, 'validation_rules.blockedDomains');
      break;
    case DynamicFieldType.PINCODE:
      assertInteger(rules.length, 'validation_rules.length');
      break;
    case DynamicFieldType.GROUP:
      validateGroupFields(rules.fields);
      assertInteger(rules.minItems, 'validation_rules.minItems');
      assertInteger(rules.maxItems, 'validation_rules.maxItems');
      break;
    case DynamicFieldType.DROPDOWN:
      assertStringArray(rules.options, 'validation_rules.options');
      if (!rules.options?.length) {
        throw new Error('validation_rules.options must contain at least one option');
      }
      break;
    case DynamicFieldType.FILE:
      assertStringArray(
        rules.allowedMimeTypes,
        'validation_rules.allowedMimeTypes'
      );
      assertNumber(rules.maxSizeMb, 'validation_rules.maxSizeMb');
      break;
    case DynamicFieldType.DATE:
      break;
  }
};

const normalizeFieldName = (fieldName: string): string => fieldName.trim();

const validateCreateDto = (dto: SchemaFieldDto): Required<Pick<SchemaFieldDto, 'field_name' | 'field_type'>> & SchemaFieldDto => {
  validateCommonDto(dto);

  if (!dto.field_name || typeof dto.field_name !== 'string' || !dto.field_name.trim()) {
    throw new Error('field_name is required');
  }

  if (!dto.field_type || !fieldTypes.has(dto.field_type)) {
    throw new Error('field_type is invalid');
  }

  validateRulesForType(dto.field_type, dto.validation_rules);

  return {
    ...dto,
    field_name: normalizeFieldName(dto.field_name),
    field_type: dto.field_type,
  };
};


export const listSchemaFields = async (tenantId: string) =>
  DynamicField.findAll({
    where: { tenant_id: tenantId },
    order: [
      ['display_order', 'ASC'],
      ['created_at', 'ASC'],
    ],
  });

export const createSchemaField = async (tenantId: string, dto: SchemaFieldDto) => {
  const data = validateCreateDto(dto);

  try {
    return await DynamicField.create({
      tenant_id: tenantId,
      field_name: data.field_name,
      field_type: data.field_type,
      required: data.required ?? false,
      display_order: data.display_order ?? 0,
      active: data.active ?? true,
      validation_rules: data.validation_rules ?? null,
    });
  } catch (err) {
    if (err instanceof UniqueConstraintError) {
      throw new Error('SCHEMA_FIELD_DUPLICATE');
    }
    throw err;
  }
};

/**
 * Create multiple schema fields in a single request/transaction.
 * Validates the entire payload, rejects on duplicates (either in payload
 * or if any of the field names already exist for the tenant).
 */
export const createSchemaFieldsBulk = async (tenantId: string, dtos: SchemaFieldDto[]) => {
  if (!Array.isArray(dtos) || dtos.length === 0) {
    throw new Error('INVALID_SCHEMA_PAYLOAD');
  }

  // Validate and normalize all items first
  const normalized = dtos.map((d) => validateCreateDto(d));

  // Check for duplicate field_name within the payload
  const names = normalized.map((n) => n.field_name);
  const dup = names.find((n, i) => names.indexOf(n) !== i);
  if (dup) {
    throw new Error(`DUPLICATE_IN_PAYLOAD:${dup}`);
  }

  // Check for existing fields in DB
  const existing = await DynamicField.findAll({
    where: {
      tenant_id: tenantId,
      field_name: { [Op.in]: names },
    },
    attributes: ['field_name'],
  });

  if (existing.length > 0) {
    // return generic duplicate error to keep API stable
    throw new Error('SCHEMA_FIELD_DUPLICATE');
  }

  // Persist all fields in a single transaction
  try {
    const rows = await sequelize.transaction(async (t) => {
      const toCreate = normalized.map((n) => ({
        tenant_id: tenantId,
        field_name: n.field_name,
        field_type: n.field_type,
        required: n.required ?? false,
        display_order: n.display_order ?? 0,
        active: n.active ?? true,
        validation_rules: n.validation_rules ?? null,
      }));

      // bulkCreate with returning works on Postgres
      return await DynamicField.bulkCreate(toCreate, { transaction: t, returning: true });
    });

    return rows;
  } catch (err) {
    if (err instanceof UniqueConstraintError) {
      throw new Error('SCHEMA_FIELD_DUPLICATE');
    }
    throw err;
  }
};



