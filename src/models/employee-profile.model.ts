import {
  Model,
  DataTypes,
  Sequelize,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  ForeignKey,
} from 'sequelize';


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
