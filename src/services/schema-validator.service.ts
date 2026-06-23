import { DynamicField, DynamicFieldType, ValidationRules, FieldValue } from '../models';

export interface ValidationError {
  field_name: string;
  field_id: number;
  value: any;
  error: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Generic field definition shape — covers both DB-backed DynamicField rows
 * AND plain JSON schema definitions (e.g. nested group children defined
 * inline under validation_rules.fields).
 */
export type FieldType = DynamicFieldType | 'select' | 'multiselect' | 'checkbox';

export interface FieldDefinition {
  field_name: string;
  field_type: FieldType; // raw incoming type string, e.g. "select", "multiselect", "checkbox"
  required: boolean;
  validation_rules?: ValidationRulesExtended | null;
  id?: number | string;
}

export interface ValidationRulesExtended extends Omit<ValidationRules, 'fields'> {
  fields?: FieldDefinition[]; // for group fields
  countryCode?: string; // for phone fields, e.g. "IN", "US"
}

/**
 * SCHEMA VALIDATOR SERVICE
 *
 * Performs runtime validation of employee field values against tenant's dynamic schema.
 * Validates:
 * - Required fields present
 * - Type coercion and validation
 * - Custom validation rules (min, max, patterns, etc.)
 * - Nested group validation (recursive, including inline group schemas)
 * - Type aliases coming from frontend ("select", "multiselect", "checkbox")
 */

/**
 * Normalize an incoming raw field_type string (which may come from the
 * frontend using different naming, e.g. "select"/"multiselect"/"checkbox")
 * into the internal DynamicFieldType enum, and patch validation_rules where
 * the alias implies an extra flag (e.g. multiselect => allowMultiple).
 */
export const normalizeFieldType = (
  rawType: FieldType,
  rules: ValidationRulesExtended
): { type: DynamicFieldType; rules: ValidationRulesExtended } => {
  switch (rawType) {
    case 'select':
      return { type: DynamicFieldType.DROPDOWN, rules: { ...rules, allowMultiple: false } };
    case 'multiselect':
      return { type: DynamicFieldType.DROPDOWN, rules: { ...rules, allowMultiple: true } };
    case 'checkbox':
      return { type: DynamicFieldType.TEXT, rules };
    case 'dropdown':
      return { type: DynamicFieldType.DROPDOWN, rules };
    default:
      // Assume rawType already matches a DynamicFieldType value (text, number, email, phone, pincode, date, file, group)
      return { type: rawType as DynamicFieldType, rules };
  }
};

/**
 * Country-specific phone validation patterns. Extend as needed.
 */
const COUNTRY_PHONE_PATTERNS: Record<string, { regex: RegExp; digits: number }> = {
  IN: { regex: /^[6-9][0-9]{9}$/, digits: 10 },
  US: { regex: /^[2-9][0-9]{9}$/, digits: 10 },
};

/**
 * Validate a single field value against its dynamic field definition.
 *
 * Handles all field types:
 * - text: minLength, maxLength, pattern
 * - number: min, max, integer flag
 * - email: allowedDomains, blockedDomains
 * - phone: pattern, minLength, maxLength, countryCode
 * - pincode: length, pattern
 * - date: minDate, maxDate, format
 * - dropdown (select/multiselect): options array, allowMultiple flag
 * - file: allowedMimeTypes, maxSizeMb
 * - checkbox: must be true if required
 * - group: recursive validation of nested fields (handled by validateGroup)
 */
export const validateFieldValue = (
  fieldName: string,
  fieldType: FieldType,
  value: any,
  validationRules: ValidationRulesExtended | null,
  isRequired: boolean
): ValidationError[] => {
  const errors: ValidationError[] = [];

  // Checkbox: required means "must be checked", false/undefined for optional is fine
  // Checkbox is handled as a separate input type, not part of the base enum.
  if (fieldType === 'checkbox') {
    if (isRequired && value !== true && value !== 'true') {
      errors.push({
        field_name: fieldName,
        field_id: 0,
        value,
        error: 'This must be checked/accepted',
      });
    }
    return errors;
  }

  // Handle required fields (skip for group — empty object is fine, validated recursively)
  const isEmpty =
    value === null ||
    value === undefined ||
    value === '' ||
    (fieldType === DynamicFieldType.GROUP && (value === undefined || value === null));

  if (isRequired && isEmpty) {
    errors.push({
      field_name: fieldName,
      field_id: 0,
      value,
      error: 'Field is required',
    });
    return errors;
  }

  // Optional field is empty — valid
  if (!isRequired && isEmpty) {
    return errors;
  }

  const rules = validationRules || {};

  switch (fieldType) {
    case DynamicFieldType.TEXT:
      validateText(fieldName, value, rules, errors);
      break;

    case DynamicFieldType.NUMBER:
      validateNumber(fieldName, value, rules, errors);
      break;

    case DynamicFieldType.EMAIL:
      validateEmail(fieldName, value, rules, errors);
      break;

    case DynamicFieldType.PHONE:
      validatePhone(fieldName, value, rules, errors);
      break;

    case DynamicFieldType.PINCODE:
      validatePincode(fieldName, value, rules, errors);
      break;

    case DynamicFieldType.DATE:
      validateDate(fieldName, value, rules, errors);
      break;

    case DynamicFieldType.DROPDOWN:
      validateDropdown(fieldName, value, rules, errors);
      break;

    case DynamicFieldType.FILE:
      validateFile(fieldName, value, rules, errors);
      break;

    case DynamicFieldType.GROUP:
      // Group validation is handled by recursive validator (validateGroup)
      break;
  }

  return errors;
};

const validateText = (
  fieldName: string,
  value: any,
  rules: ValidationRulesExtended,
  errors: ValidationError[]
) => {
  const strValue = String(value);

  if (rules.minLength && strValue.length < rules.minLength) {
    errors.push({ field_name: fieldName, field_id: 0, value, error: `Text must be at least ${rules.minLength} characters long` });
  }
  if (rules.maxLength && strValue.length > rules.maxLength) {
    errors.push({ field_name: fieldName, field_id: 0, value, error: `Text must not exceed ${rules.maxLength} characters` });
  }
  if (rules.pattern) {
    const regex = new RegExp(rules.pattern);
    if (!regex.test(strValue)) {
      errors.push({ field_name: fieldName, field_id: 0, value, error: `Text does not match required pattern: ${rules.pattern}` });
    }
  }
};

const validateNumber = (
  fieldName: string,
  value: any,
  rules: ValidationRulesExtended,
  errors: ValidationError[]
) => {
  const numValue = Number(value);

  if (isNaN(numValue)) {
    errors.push({ field_name: fieldName, field_id: 0, value, error: 'Value must be a valid number' });
    return;
  }
  if (rules.integer && !Number.isInteger(numValue)) {
    errors.push({ field_name: fieldName, field_id: 0, value, error: 'Value must be an integer' });
  }
  if (rules.min !== undefined && numValue < rules.min) {
    errors.push({ field_name: fieldName, field_id: 0, value, error: `Number must be at least ${rules.min}` });
  }
  if (rules.max !== undefined && numValue > rules.max) {
    errors.push({ field_name: fieldName, field_id: 0, value, error: `Number must not exceed ${rules.max}` });
  }
};

const validateEmail = (
  fieldName: string,
  value: any,
  rules: ValidationRulesExtended,
  errors: ValidationError[]
) => {
  const emailValue = String(value);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(emailValue)) {
    errors.push({ field_name: fieldName, field_id: 0, value, error: 'Invalid email format' });
    return;
  }

  const domain = emailValue.split('@')[1];

  if (rules.allowedDomains && rules.allowedDomains.length > 0 && !rules.allowedDomains.includes(domain)) {
    errors.push({ field_name: fieldName, field_id: 0, value, error: `Email domain must be one of: ${rules.allowedDomains.join(', ')}` });
  }
  if (rules.blockedDomains && rules.blockedDomains.includes(domain)) {
    errors.push({ field_name: fieldName, field_id: 0, value, error: `Email domain is not allowed` });
  }
};

/**
 * Phone validation now supports a `countryCode` rule, which applies a
 * country-specific regex/digit-count on top of (or instead of) the generic
 * pattern/min/max rules.
 */
const validatePhone = (
  fieldName: string,
  value: any,
  rules: ValidationRulesExtended,
  errors: ValidationError[]
) => {
  const phoneValue = String(value);
  const phoneRegex = /^\+?[0-9\s\-()]{7,}$/;

  if (!phoneRegex.test(phoneValue)) {
    errors.push({ field_name: fieldName, field_id: 0, value, error: 'Invalid phone number format' });
    return;
  }

  const digitsOnly = phoneValue.replace(/\D/g, '');

  if (rules.countryCode) {
    const countryRule = COUNTRY_PHONE_PATTERNS[rules.countryCode.toUpperCase()];
    if (countryRule) {
      // Strip a leading country dial code if present (e.g. +91XXXXXXXXXX -> keep last `digits` chars)
      const localDigits = digitsOnly.length > countryRule.digits
        ? digitsOnly.slice(-countryRule.digits)
        : digitsOnly;

      if (localDigits.length !== countryRule.digits || !countryRule.regex.test(localDigits)) {
        errors.push({
          field_name: fieldName,
          field_id: 0,
          value,
          error: `Phone number is not a valid ${rules.countryCode.toUpperCase()} number`,
        });
      }
    }
  }

  if (rules.minLength && digitsOnly.length < rules.minLength) {
    errors.push({ field_name: fieldName, field_id: 0, value, error: `Phone number must have at least ${rules.minLength} digits` });
  }
  if (rules.maxLength && digitsOnly.length > rules.maxLength) {
    errors.push({ field_name: fieldName, field_id: 0, value, error: `Phone number must not exceed ${rules.maxLength} digits` });
  }
  if (rules.pattern) {
    const regex = new RegExp(rules.pattern);
    if (!regex.test(phoneValue)) {
      errors.push({ field_name: fieldName, field_id: 0, value, error: `Phone number does not match required pattern` });
    }
  }
};

const validatePincode = (
  fieldName: string,
  value: any,
  rules: ValidationRulesExtended,
  errors: ValidationError[]
) => {
  const pincodeValue = String(value);

  if (rules.length && pincodeValue.replace(/\D/g, '').length !== rules.length) {
    errors.push({ field_name: fieldName, field_id: 0, value, error: `Pincode must be exactly ${rules.length} characters` });
  }
  if (rules.pattern) {
    const regex = new RegExp(rules.pattern);
    if (!regex.test(pincodeValue)) {
      errors.push({ field_name: fieldName, field_id: 0, value, error: `Pincode does not match required pattern` });
    }
  }
};

const validateDate = (
  fieldName: string,
  value: any,
  rules: ValidationRulesExtended,
  errors: ValidationError[]
) => {
  const dateValue = new Date(value);

  if (isNaN(dateValue.getTime())) {
    errors.push({ field_name: fieldName, field_id: 0, value, error: 'Invalid date format' });
    return;
  }
  if (rules.minDate) {
    const minDate = new Date(rules.minDate);
    if (dateValue < minDate) {
      errors.push({ field_name: fieldName, field_id: 0, value, error: `Date must be after ${rules.minDate}` });
    }
  }
  if (rules.maxDate) {
    const maxDate = new Date(rules.maxDate);
    if (dateValue > maxDate) {
      errors.push({ field_name: fieldName, field_id: 0, value, error: `Date must be before ${rules.maxDate}` });
    }
  }
};

const validateDropdown = (
  fieldName: string,
  value: any,
  rules: ValidationRulesExtended,
  errors: ValidationError[]
) => {
  const options = rules.options || [];
  const allowMultiple = rules.allowMultiple || false;

  if (!allowMultiple) {
    if (!options.includes(String(value))) {
      errors.push({ field_name: fieldName, field_id: 0, value, error: `Value must be one of: ${options.join(', ')}` });
    }
    return;
  }

  // Multiple selection: accept either a real array or a comma-separated string
  const selectedValues: string[] = Array.isArray(value)
    ? value.map((v) => String(v).trim())
    : String(value).split(',').map((v) => v.trim());

  for (const selected of selectedValues) {
    if (!options.includes(selected)) {
      errors.push({ field_name: fieldName, field_id: 0, value, error: `Invalid option: ${selected}. Must be one of: ${options.join(', ')}` });
    }
  }
};

const validateFile = (
  fieldName: string,
  value: any,
  rules: ValidationRulesExtended,
  errors: ValidationError[]
) => {
  const fileValue = String(value);

  if (!fileValue) {
    errors.push({ field_name: fieldName, field_id: 0, value, error: 'File is required' });
    return;
  }

  if (rules.allowedMimeTypes && rules.allowedMimeTypes.length > 0 && value?.mimeType) {
    if (!rules.allowedMimeTypes.includes(value.mimeType)) {
      errors.push({ field_name: fieldName, field_id: 0, value, error: `File type must be one of: ${rules.allowedMimeTypes.join(', ')}` });
    }
  }
  if (rules.maxSizeMb && value?.sizeBytes) {
    const sizeMb = value.sizeBytes / (1024 * 1024);
    if (sizeMb > rules.maxSizeMb) {
      errors.push({ field_name: fieldName, field_id: 0, value, error: `File must not exceed ${rules.maxSizeMb}MB` });
    }
  }
};

/**
 * Recursively validate a list of field definitions against a values object.
 * Works for both the top-level schema and nested group `validation_rules.fields`.
 *
 * `pathPrefix` is used to build dotted field names for nested errors,
 * e.g. "current_address.city".
 */
export const validateFieldsRecursive = (
  fieldDefs: FieldDefinition[],
  values: Record<string, any>,
  pathPrefix = ''
): ValidationError[] => {
  const errors: ValidationError[] = [];

  for (const def of fieldDefs) {
    const fullName = pathPrefix ? `${pathPrefix}.${def.field_name}` : def.field_name;
    const rawRules = (def.validation_rules || {}) as ValidationRulesExtended;
    const { type, rules } = normalizeFieldType(def.field_type, rawRules);
    const value = values ? values[def.field_name] : undefined;

    if (type === DynamicFieldType.GROUP) {
      const isMissing = value === null || value === undefined;

      if (def.required && isMissing) {
        errors.push({ field_name: fullName, field_id: Number(def.id) || 0, value, error: 'Field is required' });
        continue;
      }
      if (!def.required && isMissing) {
        continue;
      }

      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        errors.push({ field_name: fullName, field_id: Number(def.id) || 0, value, error: 'Group field must be an object' });
        continue;
      }

      const childFields = rules.fields || [];
      const nestedErrors = validateFieldsRecursive(childFields, value, fullName);
      errors.push(...nestedErrors);
      continue;
    }

    const fieldErrors = validateFieldValue(fullName, type, value, rules, def.required);
    for (const err of fieldErrors) {
      err.field_id = Number(def.id) || 0;
    }
    errors.push(...fieldErrors);
  }

  const allowedKeys = new Set(fieldDefs.map((def) => def.field_name));
  for (const providedKey of Object.keys(values || {})) {
    if (!allowedKeys.has(providedKey)) {
      const invalidName = pathPrefix ? `${pathPrefix}.${providedKey}` : providedKey;
      errors.push({
        field_name: invalidName,
        field_id: 0,
        value: values[providedKey],
        error: 'Unexpected field for tenant schema',
      });
    }
  }

  return errors;
};

/**
 * Validate employee data against a plain JSON schema (the shape produced by
 * the frontend / API response), including nested groups defined inline under
 * validation_rules.fields. Use this when the schema isn't coming from DB rows.
 */
export const validateEmployeeDataFromSchema = (
  schema: FieldDefinition[],
  values: Record<string, any>
): ValidationResult => {
  const errors = validateFieldsRecursive(schema, values);
  return { valid: errors.length === 0, errors };
};

/**
 * Validate all employee field values against tenant schema stored in DB.
 *
 * Returns:
 * - valid: true if all validations pass
 * - errors: array of validation errors with field details
 */
export const validateEmployeeData = async (
  fieldValues: Record<string, any>, // { fieldName: value }
  tenantId: string
): Promise<ValidationResult> => {
  const fields = await DynamicField.findAll({
    where: {
      tenant_id: tenantId,
      active: true,
    },
  });

  const schema: FieldDefinition[] = fields.map((f: any) => ({
    field_name: f.field_name,
    field_type: f.field_type,
    required: f.required,
    validation_rules: f.validation_rules,
    id: f.id,
  }));

  const errors = validateFieldsRecursive(schema, fieldValues);

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Coerce and normalize field value to match field type.
 * Used when storing field values to ensure consistent representation.
 */
export const coerceFieldValue = (
  fieldType: DynamicFieldType | string,
  value: any
): string => {
  if (value === null || value === undefined) {
    return '';
  }

  switch (fieldType) {
    case DynamicFieldType.TEXT:
    case 'text':
      return String(value);

    case DynamicFieldType.NUMBER:
    case 'number':
      return String(Number(value));

    case DynamicFieldType.EMAIL:
    case 'email':
      return String(value).toLowerCase();

    case DynamicFieldType.PHONE:
    case 'phone':
      return String(value).replace(/\s/g, '');

    case DynamicFieldType.PINCODE:
    case 'pincode':
      return String(value).replace(/\s/g, '');

    case DynamicFieldType.DATE:
    case 'date':
      return new Date(value).toISOString();

    case DynamicFieldType.DROPDOWN:
    case 'dropdown':
    case 'select':
      return String(value);

    case 'multiselect':
      return Array.isArray(value) ? value.join(',') : String(value);

    case DynamicFieldType.FILE:
    case 'file':
      return String(value);

    case 'checkbox':
      return value === true || value === 'true' ? 'true' : 'false';

    case DynamicFieldType.GROUP:
    case 'group':
      return typeof value === 'string' ? value : JSON.stringify(value);

    default:
      return String(value);
  }
};