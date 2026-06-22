import { DynamicField, Organization, OrgStatus } from '../models';
import { createTenantSlug } from '../utils/slug.util';

const reservedSubdomains = new Set(['www', 'api', 'localhost']);

export const resolveTenantSlug = (host?: string, explicitTenant?: unknown): string => {
  if (typeof explicitTenant === 'string' && explicitTenant.trim()) {
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

export const getTenantBootstrap = async (slug: string) => {
  const organization = await Organization.findOne({
    where: { slug, status: OrgStatus.ACTIVE },
  });

  if (!organization) {
    throw new Error('TENANT_NOT_FOUND');
  }

  const schemaFields = await DynamicField.findAll({
    where: {
      tenant_id: organization.tenant_id,
      active: true,
    },
    order: [
      ['display_order', 'ASC'],
      ['created_at', 'ASC'],
    ],
    attributes: [
      'id',
      'field_name',
      'field_type',
      'required',
      'display_order',
      'validation_rules',
    ],
  });

  return {
    tenant: {
      tenant_id: organization.tenant_id,
      org_name: organization.org_name,
      slug: organization.slug,
    },
    schema_fields: schemaFields,
  };
};
