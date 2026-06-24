import {
  Model,
  DataTypes,
  Sequelize,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  NonAttribute,
  Association,
} from 'sequelize';
import { Permission } from './permission.model';
import { RolePermission } from './role-permission.model';

export class Role extends Model<
  InferAttributes<Role>,
  InferCreationAttributes<Role>
> {
  declare id: CreationOptional<bigint>;
  declare tenant_id: string;           // UUID — tenant this role belongs to
  declare role_name: string;
  declare description: CreationOptional<string | null>;
  declare is_system_role: CreationOptional<boolean>; // true = seeded role, do not delete
  declare created_at: CreationOptional<Date>;

  // Associations (populated by Sequelize when using `include`)
  declare permissions?: NonAttribute<Permission[]>;

  declare static associations: {
    permissions: Association<Role, Permission>;
  };

  static initModel(sequelize: Sequelize): typeof Role {
    Role.init(
      {
        id: {
          type: DataTypes.BIGINT,
          autoIncrement: true,
          primaryKey: true,
        },
        tenant_id: {
          type: DataTypes.UUID,
          allowNull: false,
          comment: 'Tenant this role belongs to (row-level multi-tenancy)',
        },
        role_name: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        description: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        is_system_role: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
          comment: 'System roles are seeded and must not be deleted by tenants',
        },
        created_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
      },
      {
        sequelize,
        tableName: 'roles',
        modelName: 'Role',
        timestamps: false,
        indexes: [
          {
            // Role names must be unique per tenant
            unique: true,
            fields: ['tenant_id', 'role_name'],
            name: 'uq_roles_tenant_role_name',
          },
        ],
      }
    );

    return Role;
  }

  static associate() {
    Role.belongsToMany(Permission, {
      through: RolePermission,
      foreignKey: 'role_id',
      otherKey: 'permission_id',
      as: 'permissions',
    });
  }
}
