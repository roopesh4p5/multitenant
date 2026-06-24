import {
  Model,
  DataTypes,
  Sequelize,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from 'sequelize';


export enum OrgStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
}

export class Organization extends Model<
  InferAttributes<Organization>,
  InferCreationAttributes<Organization>
> {
  declare id: CreationOptional<bigint>;
  declare tenant_id: string;                      // UUID — globally unique per tenant
  declare org_name: string;
  declare slug: string;
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
        slug: {
          type: DataTypes.STRING,
          allowNull: false,
          unique: true,
          validate: {
            is: /^[a-z0-9]+$/,
          },
          comment: 'Public tenant slug used for subdomain routing, e.g. pacewisdom',
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
