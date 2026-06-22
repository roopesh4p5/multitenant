import {
  Model,
  DataTypes,
  Sequelize,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from 'sequelize';

/**
 * ROLEPERMISSION — Junction table linking Roles ↔ Permissions.
 *
 * Edge cases handled:
 * - Composite PRIMARY KEY (role_id, permission_id) prevents the same permission
 *   being granted to the same role more than once at the DB constraint level.
 * - `granted_at` provides an audit trail of when the permission was assigned.
 * - No surrogate PK is needed — the composite key is the identity.
 */
export class RolePermission extends Model<
  InferAttributes<RolePermission>,
  InferCreationAttributes<RolePermission>
> {
  declare role_id: bigint;
  declare permission_id: bigint;
  declare granted_at: CreationOptional<Date>;

  static initModel(sequelize: Sequelize): typeof RolePermission {
    RolePermission.init(
      {
        role_id: {
          type: DataTypes.BIGINT,
          allowNull: false,
          primaryKey: true,
          references: { model: 'roles', key: 'id' },
          onDelete: 'CASCADE', // Removing a role removes its permission grants
        },
        permission_id: {
          type: DataTypes.BIGINT,
          allowNull: false,
          primaryKey: true,
          references: { model: 'permissions', key: 'id' },
          onDelete: 'CASCADE', // Removing a permission removes all its grants
        },
        granted_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
          comment: 'Timestamp when this permission was granted to the role',
        },
      },
      {
        sequelize,
        tableName: 'role_permissions',
        modelName: 'RolePermission',
        timestamps: false,
      }
    );

    return RolePermission;
  }
}
