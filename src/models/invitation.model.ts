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

// email based invitation system for new users to join a tenant. Each invitation is tied to a specific tenant and optionally a role. The invitation has a unique token that the user can use to accept the invite. The status of the invitation tracks whether it is pending, accepted, or expired.


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
