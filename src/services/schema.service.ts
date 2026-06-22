import { UniqueConstraintError } from 'sequelize';
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

const validateUpdateDto = (
  existingFieldType: DynamicFieldType,
  dto: SchemaFieldDto
): SchemaFieldDto => {
  validateCommonDto(dto);

  if (dto.field_name !== undefined) {
    if (typeof dto.field_name !== 'string' || !dto.field_name.trim()) {
      throw new Error('field_name cannot be empty');
    }
    dto.field_name = normalizeFieldName(dto.field_name);
  }

  if (dto.field_type !== undefined && !fieldTypes.has(dto.field_type)) {
    throw new Error('field_type is invalid');
  }

  const nextFieldType = dto.field_type ?? existingFieldType;
  validateRulesForType(nextFieldType, dto.validation_rules);

  return dto;
};

export const listSchemaFields = async (tenantId: string) =>
  DynamicField.findAll({
    where: { tenant_id: tenantId },
    order: [
      ['display_order', 'ASC'],
      ['created_at', 'ASC'],
    ],
  });

export const getSchemaField = async (tenantId: string, fieldId: string) => {
  const field = await DynamicField.findOne({
    where: { id: fieldId, tenant_id: tenantId },
  });

  if (!field) throw new Error('SCHEMA_FIELD_NOT_FOUND');
  return field;
};

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

export const updateSchemaField = async (
  tenantId: string,
  fieldId: string,
  dto: SchemaFieldDto
) => {
  const field = await getSchemaField(tenantId, fieldId);
  const data = validateUpdateDto(field.field_type, dto);

  try {
    await field.update(data);
    return field;
  } catch (err) {
    if (err instanceof UniqueConstraintError) {
      throw new Error('SCHEMA_FIELD_DUPLICATE');
    }
    throw err;
  }
};

export const deleteSchemaField = async (tenantId: string, fieldId: string) => {
  const field = await getSchemaField(tenantId, fieldId);
  await field.destroy();
};
