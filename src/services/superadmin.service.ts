import { sequelize } from '../config/dbconfig';
import {
  Organization,
  User,
  ApprovalHistory,
  OrgStatus,
  UserStatus,
  ApprovalAction,
} from '../models';
import { Op } from 'sequelize';


// list orgs
export const getPendingOrgs = async () => {
  const orgs = await Organization.findAll({
    where: { status: OrgStatus.INACTIVE },
    include: [
      {
        model: User,
        as: 'users',
        // Only include the org admin (is_system_role user — the first user for tenant)
        where: { status: [UserStatus.PENDING, UserStatus.REJECTED] },
        attributes: ['id', 'name', 'email', 'phone', 'status', 'created_at'],
        required: false,
      },
    ],
    order: [['created_at', 'ASC']], // Oldest first — review in order
  });

  return orgs;
};

// aprove/reject orgs
export type ApprovalActionType = 'approve' | 'reject';


export const approveOrRejectOrg = async (
  orgId: string,
  action: ApprovalActionType,
  actorId: number,
  remarks?: string
) => {
  const org = await Organization.findOne({ where: { tenant_id: orgId } });
  if (!org) throw new Error('ORG_NOT_FOUND');

  // Only inactive orgs can be reviewed
  if (org.status !== OrgStatus.INACTIVE) {
    throw new Error('ORG_ALREADY_REVIEWED');
  }

  await sequelize.transaction(async (t) => {
    const newOrgStatus =
      action === 'approve' ? OrgStatus.ACTIVE : OrgStatus.INACTIVE;

    const newUserStatus =
      action === 'approve' ? UserStatus.ACTIVE : UserStatus.REJECTED;

    const historyAction =
      action === 'approve' ? ApprovalAction.APPROVED : ApprovalAction.REJECTED;

    // Update org status (only meaningful on approve — stays inactive on reject)
    if (action === 'approve') {
      await org.update({ status: newOrgStatus }, { transaction: t });
    }

    // Find all pending users in this tenant
    const pendingUsers = await User.findAll({
      where: {
        tenant_id: org.tenant_id,
        status: { [Op.in]: [UserStatus.PENDING] },
      },
      transaction: t,
    });

    // Update each user and create approval history
    for (const user of pendingUsers) {
      await user.update({ status: newUserStatus }, { transaction: t });

      await ApprovalHistory.create(
        {
          user_id: user.id,
          action: historyAction,
          performed_by: actorId === 0 ? null : BigInt(actorId), // 0 = system superadmin
          remarks: remarks ?? null,
        },
        { transaction: t }
      );
    }
  });

  return {
    message:
      action === 'approve'
        ? 'Organization approved. Admin can now log in.'
        : 'Organization rejected.',
    org_id: orgId,
    action,
  };
};

//Get orgs with filter

export const getAllOrgs = async (status?: OrgStatus) => {
  const where = status ? { status } : {};
  return Organization.findAll({
    where,
    include: [
      {
        model: User,
        as: 'users',
        attributes: ['id', 'name', 'email', 'status'],
        required: false,
      },
    ],
    order: [['created_at', 'DESC']],
  });
};
