import {
  Model,
  DataTypes,
  Sequelize,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  ForeignKey,
} from 'sequelize';

/**
 * FIELDVALUE — Stores the actual data for a dynamic field per employee.
 *
 * Design philosophy:
 * - `value` is stored as TEXT regardless of the DynamicField's `field_type`.
 *   Serialization/deserialization and type coercion is handled in the service layer
 *   using the parent DynamicField's `field_type` and `validation_rules`.
 *   Examples:
 *     - number  → stored as "42" or "3.14"
 *     - date    → stored as ISO 8601 string "2024-01-15T00:00:00.000Z"
 *     - dropdown→ stored as "OptionA" or "OptionA,OptionB" (if allowMultiple)
 *     - file    → stored as a URL or file path string
 *
 * Edge cases handled:
 * - Composite UNIQUE index `[employee_id, field_id]` prevents multiple values for
 *   the same field on the same employee at the DB level.
 *   Use UPSERT (INSERT ... ON CONFLICT DO UPDATE) in the service layer.
 * - `employee_id` CASCADE DELETE — removing an EmployeeProfile wipes all their values.
 * - `field_id` RESTRICT on delete — you cannot delete a DynamicField that still has
 *   values. First clear/migrate values, then delete the field. This prevents orphaned
 *   data or accidental mass data loss.
 * - Both `created_at` and `updated_at` are tracked to support audit of when values
 *   were first set vs. last modified.
 */
export class FieldValue extends Model<
  InferAttributes<FieldValue>,
  InferCreationAttributes<FieldValue>
> {
  declare id: CreationOptional<bigint>;
  declare employee_id: ForeignKey<bigint>;    // FK → EmployeeProfile
  declare field_id: ForeignKey<bigint>;       // FK → DynamicField
  declare value: string;                       // Always TEXT — type safety in service layer
  declare created_at: CreationOptional<Date>;
  declare updated_at: CreationOptional<Date>;

  static initModel(sequelize: Sequelize): typeof FieldValue {
    FieldValue.init(
      {
        id: {
          type: DataTypes.BIGINT,
          autoIncrement: true,
          primaryKey: true,
        },
        employee_id: {
          type: DataTypes.BIGINT,
          allowNull: false,
          references: { model: 'employee_profiles', key: 'id' },
          onDelete: 'CASCADE',  // Profile deleted → all field values deleted
          onUpdate: 'CASCADE',
        },
        field_id: {
          type: DataTypes.BIGINT,
          allowNull: false,
          references: { model: 'dynamic_fields', key: 'id' },
          onDelete: 'RESTRICT',  // Cannot delete a field that has saved values
          onUpdate: 'CASCADE',
        },
        value: {
          type: DataTypes.TEXT,
          allowNull: false,
          comment: 'All field types stored as TEXT — deserialized by service layer',
        },
        created_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
        updated_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
      },
      {
        sequelize,
        tableName: 'field_values',
        modelName: 'FieldValue',
        timestamps: false,
        indexes: [
          {
            // One value per field per employee — use UPSERT in service layer
            unique: true,
            fields: ['employee_id', 'field_id'],
            name: 'uq_field_values_employee_field',
          },
        ],
      }
    );

    return FieldValue;
  }
}
