import {
  Model,
  DataTypes,
  Sequelize,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  ForeignKey,
  NonAttribute,
  Association,
} from 'sequelize';
import { Role } from './role.model';

/**
 * User approval/activity lifecycle:
 *
 *   [pending] ──► [approved] ──► [active]
 *       │                    └──► [inactive]
 *       └──► [rejected]
 *
 * - pending:  Newly registered; awaiting admin approval.
 * - approved: Admin approved; user may now activate (set password, etc.).
 * - rejected: Admin rejected; user cannot log in.
 * - active:   Fully operational account.
 * - inactive: Soft-disabled; no login allowed but data retained.
 *
 * Every transition is recorded in ApprovalHistory.
 */
export enum UserStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

/**
 * USER — Tenant-scoped user accounts.
 *
 * Edge cases handled:
 * - Composite unique index `[tenant_id, email]` allows the same email across
 *   different tenants (common in B2B SaaS) but prevents duplicates within a tenant.
 * - `password_hash` stores a bcrypt/argon2 hash — NEVER the plaintext password.
 * - `role_id` is nullable with SET NULL on delete so removing a role doesn't
 *   cascade-delete all users — it simply unsets their role (handled by re-assigning).
 * - `phone` is nullable — not all tenants may require it.
 */
export class User extends Model<
  InferAttributes<User>,
  InferCreationAttributes<User>
> {
  declare id: CreationOptional<bigint>;
  declare tenant_id: string;                        // UUID
  declare name: string;
  declare email: string;
  declare phone: CreationOptional<string | null>;
  declare password_hash: string;
  declare role_id: ForeignKey<bigint | null>;       // nullable — user may be unassigned
  declare status: CreationOptional<UserStatus>;
  declare created_at: CreationOptional<Date>;
  declare updated_at: CreationOptional<Date>;

  // Populated via associations
  declare role?: NonAttribute<Role>;

  declare static associations: {
    role: Association<User, Role>;
  };

  static initModel(sequelize: Sequelize): typeof User {
    User.init(
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
        name: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        email: {
          type: DataTypes.STRING,
          allowNull: false,
          validate: {
            isEmail: true, // Model-level email format validation
          },
        },
        phone: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        password_hash: {
          type: DataTypes.STRING,
          allowNull: false,
          comment: 'Stores bcrypt/argon2 hash only — never plaintext',
        },
        role_id: {
          type: DataTypes.BIGINT,
          allowNull: true,
          references: { model: 'roles', key: 'id' },
          onDelete: 'SET NULL', // Deleting a role unsets it from users, not cascades
          onUpdate: 'CASCADE',
        },
        status: {
          type: DataTypes.ENUM(...Object.values(UserStatus)),
          allowNull: false,
          defaultValue: UserStatus.PENDING,
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
        tableName: 'users',
        modelName: 'User',
        timestamps: false, // Manually managed above for explicit control
        indexes: [
          {
            // Same email is OK across tenants, but NOT within the same tenant
            unique: true,
            fields: ['tenant_id', 'email'],
            name: 'uq_users_tenant_email',
          },
        ],
      }
    );

    return User;
  }

  static associate() {
    // Associations are set up in index.ts to avoid circular import issues
  }
}
