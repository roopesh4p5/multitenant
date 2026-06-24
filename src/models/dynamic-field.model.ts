import {
  Model,
  DataTypes,
  Sequelize,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from 'sequelize';

export enum DynamicFieldType {
  TEXT = 'text',
  NUMBER = 'number',
  PHONE = 'phone',
  EMAIL = 'email',
  PINCODE = 'pincode',
  GROUP = 'group',
  DATE = 'date',
  DROPDOWN = 'dropdown',
  FILE = 'file',
}

export interface GroupFieldDefinition {
  field_name: string;
  field_type: DynamicFieldType;
  required?: boolean;
  validation_rules?: ValidationRules | null;
  fields?: GroupFieldDefinition[];
}


export interface ValidationRules {
  // text
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  // number
  min?: number;
  max?: number;
  integer?: boolean;
  // phone/email/pincode
  countryCode?: string;
  length?: number;
  allowedDomains?: string[];
  blockedDomains?: string[];
  // group
  fields?: GroupFieldDefinition[];
  minItems?: number;
  maxItems?: number;
  // date
  minDate?: string;
  maxDate?: string;
  format?: string;
  // dropdown
  options?: string[];
  allowMultiple?: boolean;
  // file
  allowedMimeTypes?: string[];
  maxSizeMb?: number;
}

export class DynamicField extends Model<
  InferAttributes<DynamicField>,
  InferCreationAttributes<DynamicField>
> {
  declare id: CreationOptional<bigint>;
  declare tenant_id: string;                            // UUID
  declare field_name: string;
  declare field_type: DynamicFieldType;
  declare required: CreationOptional<boolean>;
  declare display_order: CreationOptional<number>;
  declare active: CreationOptional<boolean>;
  declare validation_rules: CreationOptional<ValidationRules | null>;
  declare created_at: CreationOptional<Date>;

  static initModel(sequelize: Sequelize): typeof DynamicField {
    DynamicField.init(
      {
        id: {
          type: DataTypes.BIGINT,
          autoIncrement: true,
          primaryKey: true,
        },
        tenant_id: {
          type: DataTypes.UUID,
          allowNull: false,
        },
        field_name: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        field_type: {
          type: DataTypes.ENUM(...Object.values(DynamicFieldType)),
          allowNull: false,
        },
        required: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
          comment: 'If true, EmployeeProfile is incomplete without a value for this field',
        },
        display_order: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
          comment: 'Render order in the UI — lower numbers appear first',
        },
        active: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true,
          comment: 'Disabled fields are hidden from forms but FieldValues are preserved',
        },
        validation_rules: {
          type: DataTypes.JSONB, // JSONB for efficient Postgres querying
          allowNull: true,
          comment: 'Type-specific validation constraints — see ValidationRules interface',
        },
        created_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
      },
      {
        sequelize,
        tableName: 'dynamic_fields',
        modelName: 'DynamicField',
        timestamps: false,
        indexes: [
          {
            // Field names must be unique within a tenant
            unique: true,
            fields: ['tenant_id', 'field_name'],
            name: 'uq_dynamic_fields_tenant_field_name',
          },
          {
            // Fetch all active fields for a tenant in order — common query
            fields: ['tenant_id', 'active', 'display_order'],
            name: 'idx_dynamic_fields_tenant_active_order',
          },
        ],
      }
    );

    return DynamicField;
  }
}
