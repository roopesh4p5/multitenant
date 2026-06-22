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
 * Actions that can be recorded in the approval history.
 * Matches the User status lifecycle transitions.
 */
export enum ApprovalAction {
  APPROVED = 'approved',
  REJECTED = 'rejected',
  PENDING = 'pending',   // e.g., reverting to pending for re-review
}

/**
 * APPROVALHISTORY — Immutable audit trail for user status transitions.
 *
 * This table is APPEND-ONLY. Records must never be updated or deleted.
 * It captures:
 *   WHO (performed_by) did WHAT (action) to WHOM (user_id) and WHY (remarks).
 *
 * Edge cases handled:
 * - `performed_by` is NULLABLE — system-initiated transitions (e.g., auto-expiry)
 *   have no human actor. SET NULL on delete preserves history even if the admin
 *   account is removed.
 * - `user_id` uses RESTRICT on delete — you cannot delete a user who has approval
 *   history (compliance requirement: audit trail must be preserved). Archive/soft-
 *   delete the user instead.
 * - `remarks` is nullable — not all transitions require a reason, but rejections
 *   should always include one (enforced in service layer).
 * - No `updated_at` — this model is immutable by design. A new row is always
 *   inserted for each transition.
 * - Index on `[user_id, created_at]` supports efficient timeline queries:
 *   "show all approval history for this user, newest first".
 */
export class ApprovalHistory extends Model<
  InferAttributes<ApprovalHistory>,
  InferCreationAttributes<ApprovalHistory>
> {
  declare id: CreationOptional<bigint>;
  declare user_id: ForeignKey<bigint>;              // The subject (whose status changed)
  declare action: ApprovalAction;
  declare performed_by: ForeignKey<bigint | null>; // The actor (admin) — nullable for system
  declare remarks: CreationOptional<string | null>;
  declare created_at: CreationOptional<Date>;

  static initModel(sequelize: Sequelize): typeof ApprovalHistory {
    ApprovalHistory.init(
      {
        id: {
          type: DataTypes.BIGINT,
          autoIncrement: true,
          primaryKey: true,
        },
        user_id: {
          type: DataTypes.BIGINT,
          allowNull: false,
          references: { model: 'users', key: 'id' },
          onDelete: 'RESTRICT',  // Preserve audit trail — cannot delete a user with history
          onUpdate: 'CASCADE',
        },
        action: {
          type: DataTypes.ENUM(...Object.values(ApprovalAction)),
          allowNull: false,
        },
        performed_by: {
          type: DataTypes.BIGINT,
          allowNull: true,
          references: { model: 'users', key: 'id' },
          onDelete: 'SET NULL', // Actor deleted → keep history, clear actor reference
          onUpdate: 'CASCADE',
          comment: 'The admin who performed this action. Null = system-triggered.',
        },
        remarks: {
          type: DataTypes.TEXT,
          allowNull: true,
          comment: 'Reason for action — required for rejections (enforced in service)',
        },
        created_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
      },
      {
        sequelize,
        tableName: 'approval_history',
        modelName: 'ApprovalHistory',
        timestamps: false,
        indexes: [
          {
            // Efficient timeline query: "all history for user X, newest first"
            fields: ['user_id', 'created_at'],
            name: 'idx_approval_history_user_created',
          },
          {
            // "What actions did admin Y perform?" — useful for admin audit dashboards
            fields: ['performed_by'],
            name: 'idx_approval_history_performed_by',
          },
        ],
      }
    );

    return ApprovalHistory;
  }
}
