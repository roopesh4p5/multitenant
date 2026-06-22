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
 * Invitation states:
 * - pending:  Token sent, awaiting user action.
 * - accepted: User clicked link and completed registration.
 * - expired:  expires_at passed — link no longer valid.
 *
 * Once accepted or expired, the token should be considered consumed.
 * A middleware/cron job should periodically mark pending invitations as
 * expired when `expires_at < NOW()`.
 */
export enum InvitationStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  EXPIRED = 'expired',
}

/**
 * INVITATION — Email-based invitation with signed token and TTL.
 *
 * Edge cases handled:
 * - `token` has a UNIQUE constraint — one-time use token. After acceptance the
 *   status flips to `accepted` and the same token cannot be reused (status check
 *   in service layer).
 * - `invited_by` is NULLABLE (SET NULL on delete) because the first superadmin
 *   invitation may be system-seeded without a user as inviter.
 * - `role_id` is NULLABLE (SET NULL on delete) — if the invited role is deleted
 *   before the invite is accepted, the invitation becomes role-less. Service layer
 *   should validate this before allowing acceptance.
 * - `expires_at` is always set — no open-ended invites. Typical TTL: 72 hours.
 * - Composite index `[tenant_id, email, status]` speeds up "does this email have a
 *   pending invite in this tenant?" queries.
 */
export class Invitation extends Model<
  InferAttributes<Invitation>,
  InferCreationAttributes<Invitation>
> {
  declare id: CreationOptional<bigint>;
  declare tenant_id: string;                          // UUID
  declare email: string;
  declare role_id: ForeignKey<bigint | null>;
  declare token: string;                               // Unique secure token (UUID v4 / crypto)
  declare status: CreationOptional<InvitationStatus>;
  declare invited_by: ForeignKey<bigint | null>;       // Nullable — system-seeded invites
  declare expires_at: Date;
  declare created_at: CreationOptional<Date>;

  static initModel(sequelize: Sequelize): typeof Invitation {
    Invitation.init(
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
        email: {
          type: DataTypes.STRING,
          allowNull: false,
          validate: {
            isEmail: true,
          },
        },
        role_id: {
          type: DataTypes.BIGINT,
          allowNull: true,
          references: { model: 'roles', key: 'id' },
          onDelete: 'SET NULL',
          onUpdate: 'CASCADE',
          comment: 'Role to assign on invite acceptance — nullable if role is deleted',
        },
        token: {
          type: DataTypes.STRING,
          allowNull: false,
          unique: true,
          comment: 'Cryptographically secure one-time token for the invite link',
        },
        status: {
          type: DataTypes.ENUM(...Object.values(InvitationStatus)),
          allowNull: false,
          defaultValue: InvitationStatus.PENDING,
        },
        invited_by: {
          type: DataTypes.BIGINT,
          allowNull: true,
          references: { model: 'users', key: 'id' },
          onDelete: 'SET NULL', // Inviter deleted → keep invite record but unlink inviter
          onUpdate: 'CASCADE',
        },
        expires_at: {
          type: DataTypes.DATE,
          allowNull: false,
          comment: 'Hard expiry — invite links are invalid after this timestamp',
        },
        created_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
      },
      {
        sequelize,
        tableName: 'invitations',
        modelName: 'Invitation',
        timestamps: false,
        indexes: [
          {
            // Fast lookup: "does this email already have a pending invite in this tenant?"
            fields: ['tenant_id', 'email', 'status'],
            name: 'idx_invitations_tenant_email_status',
          },
        ],
      }
    );

    return Invitation;
  }
}
