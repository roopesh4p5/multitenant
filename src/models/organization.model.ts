import {
  Model,
  DataTypes,
  Sequelize,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from 'sequelize';

/**
 * Valid organization statuses.
 * - active:    Fully operational; users can be created and log in.
 * - inactive:  Temporarily disabled; login is blocked but data is preserved.
 * - suspended: Forcibly suspended (e.g., payment failure); all access denied.
 */
export enum OrgStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
}

/**
 * ORGANIZATION — The top-level tenant entity.
 *
 * Edge cases handled:
 * - `tenant_id` is UNIQUE — enforces exactly one Organization per tenant.
 *   This is the multitenant anchor: all other tenant-scoped data hangs off this UUID.
 * - `gst_no` is globally UNIQUE — GST numbers are government-issued and must not collide
 *   across tenants either.
 * - `employee_count` is a cached counter (INT). The actual source of truth is the
 *   count of EmployeeProfiles. This can be kept in sync via Sequelize hooks or a
 *   DB trigger (not enforced here).
 * - `status` enum controls the operational state of the entire tenant org.
 */
export class Organization extends Model<
  InferAttributes<Organization>,
  InferCreationAttributes<Organization>
> {
  declare id: CreationOptional<bigint>;
  declare tenant_id: string;                      // UUID — globally unique per tenant
  declare org_name: string;
  declare gst_no: string;                          // GST number — globally unique
  declare employee_count: CreationOptional<number>;
  declare description: CreationOptional<string | null>;
  declare status: CreationOptional<OrgStatus>;
  declare created_at: CreationOptional<Date>;

  static initModel(sequelize: Sequelize): typeof Organization {
    Organization.init(
      {
        id: {
          type: DataTypes.BIGINT,
          autoIncrement: true,
          primaryKey: true,
        },
        tenant_id: {
          type: DataTypes.UUID,
          allowNull: false,
          unique: true,
          comment: 'Globally unique tenant identifier — one org per tenant',
        },
        org_name: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        gst_no: {
          type: DataTypes.STRING,
          allowNull: false,
          unique: true,
          comment: 'GST registration number — must be globally unique',
        },
        employee_count: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
          validate: {
            min: 0, // Cannot be negative
          },
          comment: 'Cached employee count — sync via hook or DB trigger',
        },
        description: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        status: {
          type: DataTypes.ENUM(...Object.values(OrgStatus)),
          allowNull: false,
          defaultValue: OrgStatus.ACTIVE,
        },
        created_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
      },
      {
        sequelize,
        tableName: 'organizations',
        modelName: 'Organization',
        timestamps: false,
      }
    );

    return Organization;
  }

  static associate() {
    // Associations are defined in index.ts to avoid circular imports
  }
}
