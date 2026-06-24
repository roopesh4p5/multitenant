import {
  Model,
  DataTypes,
  Sequelize,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from 'sequelize';


export class Permission extends Model<
  InferAttributes<Permission>,
  InferCreationAttributes<Permission>
> {
  declare id: CreationOptional<bigint>;
  declare permission_name: string;
  declare resource: string;   // e.g. "users", "reports", "settings"
  declare action: string;     // e.g. "create", "read", "update", "delete"
  declare description: CreationOptional<string | null>;

  static initModel(sequelize: Sequelize): typeof Permission {
    Permission.init(
      {
        id: {
          type: DataTypes.BIGINT,
          autoIncrement: true,
          primaryKey: true,
        },
        permission_name: {
          type: DataTypes.STRING,
          allowNull: false,
          comment: 'Human-readable name e.g. "Read Users"',
        },
        resource: {
          type: DataTypes.STRING,
          allowNull: false,
          comment: 'The resource this permission targets e.g. "users"',
        },
        action: {
          type: DataTypes.STRING,
          allowNull: false,
          comment: 'The action on the resource e.g. "read", "create"',
        },
        description: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
      },
      {
        sequelize,
        tableName: 'permissions',
        modelName: 'Permission',
        timestamps: false,
        indexes: [
          {
            // Prevent duplicate permission definitions (resource + action must be unique)
            unique: true,
            fields: ['resource', 'action'],
            name: 'uq_permissions_resource_action',
          },
        ],
      }
    );

    return Permission;
  }
}
