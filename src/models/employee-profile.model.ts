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
 * EMPLOYEEPROFILE — Extended employee data for a user, with an approval workflow.
 *
 * Relationship to User:
 * - One user → one employee profile (enforced by UNIQUE on `user_id`).
 * - A user must exist before a profile is created.
 * - `approved_by` references the admin user who approved the profile.
 *
 * Edge cases handled:
 * - `user_id` is UNIQUE — prevents creating duplicate profiles for the same user.
 * - `approved_by` is NULLABLE — profile starts in an unapproved state with no approver.
 *   When a superadmin approves the profile, both `approved_by` and `approved_at` are set.
 * - `approved_by` uses SET NULL on delete — if the approving admin's account is removed,
 *   the profile record is preserved and the approver reference is cleared.
 * - `tenant_id` is redundant with the user's tenant but is stored here for efficient
 *   tenant-scoped queries on profiles without joining the users table.
 * - Self-referential approval (user approving their own profile) must be prevented
 *   in the service layer — cannot be enforced at the DB level without a CHECK constraint.
 */
export class EmployeeProfile extends Model<
  InferAttributes<EmployeeProfile>,
  InferCreationAttributes<EmployeeProfile>
> {
  declare id: CreationOptional<bigint>;
  declare user_id: ForeignKey<bigint>;              // The employee (owns the profile)
  declare tenant_id: string;                         // UUID — denormalized for fast queries
  declare approved_by: ForeignKey<bigint | null>;   // The admin who approved
  declare approved_at: CreationOptional<Date | null>;
  declare created_at: CreationOptional<Date>;
  declare updated_at: CreationOptional<Date>;

  static initModel(sequelize: Sequelize): typeof EmployeeProfile {
    EmployeeProfile.init(
      {
        id: {
          type: DataTypes.BIGINT,
          autoIncrement: true,
          primaryKey: true,
        },
        user_id: {
          type: DataTypes.BIGINT,
          allowNull: false,
          unique: true, // Enforces one profile per user at the DB level
          references: { model: 'users', key: 'id' },
          onDelete: 'CASCADE', // Deleting a user deletes their profile
          onUpdate: 'CASCADE',
        },
        tenant_id: {
          type: DataTypes.UUID,
          allowNull: false,
          comment: 'Denormalized for direct tenant-scoped queries on profiles',
        },
        approved_by: {
          type: DataTypes.BIGINT,
          allowNull: true,
          references: { model: 'users', key: 'id' },
          onDelete: 'SET NULL', // Approver account deleted → preserve profile
          onUpdate: 'CASCADE',
          comment: 'Admin who approved this profile. Null = not yet approved.',
        },
        approved_at: {
          type: DataTypes.DATE,
          allowNull: true,
          comment: 'Timestamp of approval. Null = pending approval.',
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
        tableName: 'employee_profiles',
        modelName: 'EmployeeProfile',
        timestamps: false,
        indexes: [
          {
            // Efficient lookup of all profiles for a given tenant
            fields: ['tenant_id'],
            name: 'idx_employee_profiles_tenant',
          },
          {
            // Find unapproved profiles quickly
            fields: ['approved_by'],
            name: 'idx_employee_profiles_approved_by',
          },
        ],
      }
    );

    return EmployeeProfile;
  }
}
