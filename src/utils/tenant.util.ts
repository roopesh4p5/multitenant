import { Request } from 'express';

export const getTenantId = (req: Request): string => {
  const tenantId = req.user?.tenantId;

  if (!tenantId || tenantId === 'system' || req.user?.isSuperAdmin) {
    throw new Error('TENANT_ACCESS_REQUIRED');
  }

  return tenantId;
};

export const tenantWhere = <T extends Record<string, unknown>>(
  req: Request,
  where: T = {} as T
): T & { tenant_id: string } => ({
  ...where,
  tenant_id: getTenantId(req),
});

export const assertTenantAccess = (req: Request, tenantId: string): void => {
  if (req.user?.isSuperAdmin) return;

  if (tenantId !== getTenantId(req)) {
    throw new Error('CROSS_TENANT_ACCESS_DENIED');
  }
};
