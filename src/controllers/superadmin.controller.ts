import { Request, Response } from 'express';
import {
  getPendingOrgs,
  approveOrRejectOrg,
  getAllOrgs,
} from '../services/superadmin.service';
import { OrgStatus } from '../models';


export const listOrgs = async (req: Request, res: Response): Promise<void> => {
  const { status } = req.query;

  try {
    let orgs;

    const statusStr = Array.isArray(status) ? status[0] : status;

    if (!statusStr || statusStr === 'inactive') {
      orgs = await getPendingOrgs();
    } else if (statusStr === 'all') {
      orgs = await getAllOrgs();
    } else {
      orgs = await getAllOrgs(statusStr as OrgStatus);
    }

    res.status(200).json({ success: true, data: orgs, count: orgs.length });
  } catch (err) {
    console.error('listOrgs', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};


export const approveOrg = async (req: Request, res: Response): Promise<void> => {
  const orgId = String(req.params.id);
  const { action, remarks } = req.body;

  if (!orgId || typeof orgId !== 'string') {
    res.status(400).json({ success: false, message: 'Invalid org UUID' });
    return;
  }

  if (!action || !['approve', 'reject'].includes(action)) {
    res.status(400).json({
      success: false,
      message: 'action must be "approve" or "reject"',
    });
    return;
  }

  if (action === 'reject' && !remarks?.trim()) {
    res.status(400).json({
      success: false,
      message: 'remarks are required when rejecting an organization',
    });
    return;
  }

  const actorId = 0; 

  try {
    const result = await approveOrRejectOrg(orgId, action, actorId, remarks);
    res.status(200).json({ success: true, data: result });
  } catch (err: any) {
    if (err.message === 'ORG_NOT_FOUND') {
      res.status(404).json({ success: false, message: 'Organization not found' });
      return;
    }
    if (err.message === 'ORG_ALREADY_REVIEWED') {
      res.status(409).json({
        success: false,
        message: 'This organization has already been reviewed',
      });
      return;
    }
    console.error('approveOrg', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
