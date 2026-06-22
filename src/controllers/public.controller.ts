import { Request, Response } from 'express';
import { getTenantBootstrap, resolveTenantSlug } from '../services/public.service';

export const tenantBootstrap = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const slug = resolveTenantSlug(req.get('host'), req.query.tenant);
    const data = await getTenantBootstrap(slug);
    res.status(200).json({ success: true, data });
  } catch (err: any) {
    if (err.message === 'TENANT_SLUG_REQUIRED') {
      res.status(400).json({
        success: false,
        message: 'Tenant slug is required. Use a tenant subdomain or ?tenant=pacewisdom.',
      });
      return;
    }

    if (err.message === 'TENANT_NOT_FOUND') {
      res.status(404).json({ success: false, message: 'Tenant not found or inactive' });
      return;
    }

    console.error('[tenantBootstrap]', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
