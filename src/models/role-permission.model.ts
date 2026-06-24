import {
  Model,
  DataTypes,
  Sequelize,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from 'sequelize';

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
