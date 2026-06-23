import { Request } from 'express';
import { Organization } from '../models';
import { createTenantSlug } from './slug.util';

const reservedSubdomains = new Set(['www', 'api', 'localhost']);

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

/**
 * Get tenant ID from request for unauthenticated endpoints.
 * Resolves tenant from:
 * 1. req.user.tenantId (if authenticated)
 * 2. Query parameter ?tenant=slug (explicit slug)
 * 3. Subdomain (from host header)
 */
export const getTenantIdFromRequest = async (req: Request): Promise<string> => {
  // If already authenticated, use that
  if (req.user?.tenantId) {
    return req.user.tenantId;
  }

  // Resolve tenant slug from request
  const slug = resolveTenantSlugFromRequest(
    req.get('host'),
    req.query.tenant as string | undefined
  );

  // Look up tenant by slug
  const organization = await Organization.findOne({
    where: { slug },
  });

  if (!organization) {
    throw new Error('TENANT_NOT_FOUND');
  }

  return organization.tenant_id;
};

/**
 * Resolve tenant slug from host or query parameter.
 */
export const resolveTenantSlugFromRequest = (
  host?: string,
  explicitTenant?: string
): string => {
  if (explicitTenant && explicitTenant.trim()) {
    return createTenantSlug(explicitTenant);
  }

  if (!host) {
    throw new Error('TENANT_SLUG_REQUIRED');
  }

  const hostname = host.split(':')[0].toLowerCase();
  const [subdomain] = hostname.split('.');

  if (!subdomain || reservedSubdomains.has(subdomain)) {
    throw new Error('TENANT_SLUG_REQUIRED');
  }

  return createTenantSlug(subdomain);
};
