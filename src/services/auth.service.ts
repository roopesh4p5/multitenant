import { v4 as uuidv4 } from 'uuid';
import { sequelize } from '../config/dbconfig';
import {
  Organization,
  Role,
  User,
  OrgStatus,
  UserStatus,
} from '../models';
import { hashPassword, verifyPassword } from '../utils/password.util';
import { signToken } from '../utils/jwt.util';
import { createTenantSlug } from '../utils/slug.util';

export interface RegisterOrgAdminDto {
  org_name: string;
  gst_no: string;
  admin_name: string;
  email: string;
  password: string;
  phone?: string;
  employee_count?: number;
  description?: string;
}

export interface LoginDto {
  email: string;
  password: string;
}


export const registerOrgAdmin = async (dto: RegisterOrgAdminDto) => {
  const { org_name, gst_no, admin_name, email, password, phone, employee_count, description } = dto;
  const slug = createTenantSlug(org_name);

  if (!slug) {
    throw new Error('INVALID_ORG_NAME');
  }

  const existingEmail = await User.findOne({ where: { email } });
  if (existingEmail) {
    throw new Error('EMAIL_TAKEN');
  }

  const existingGst = await Organization.findOne({ where: { gst_no } });
  if (existingGst) {
    throw new Error('GST_TAKEN');
  }

  const existingSlug = await Organization.findOne({ where: { slug } });
  if (existingSlug) {
    throw new Error('ORG_SLUG_TAKEN');
  }

  const tenant_id = uuidv4();
  const password_hash = await hashPassword(password);

  const result = await sequelize.transaction(async (t) => {
    const org = await Organization.create(
      {
        tenant_id,
        org_name,
        slug,
        gst_no,
        status: OrgStatus.INACTIVE,
        employee_count: typeof employee_count === 'number' ? employee_count : 0,
        description: description ?? null,
      },
      { transaction: t }
    );

    const role = await Role.create(
      {
        tenant_id,
        role_name: 'org_admin',
        description: 'Organization administrator — full access within the tenant',
        is_system_role: true,
      },
      { transaction: t }
    );

    const user = await User.create(
      {
        tenant_id,
        name: admin_name,
        email,
        phone: phone ?? null,
        password_hash,
        role_id: role.id,
        status: UserStatus.PENDING,
      },
      { transaction: t }
    );

    return { org, role, user };
  });

  return {
    message:
      'Registration successful. Your organization is under review. You will be notified once approved.',
    tenant_id,
    org_id: result.org.tenant_id,
    user_id: result.user.id,
    organization: {
      org_name: result.org.org_name,
      slug: result.org.slug,
      gst_no: result.org.gst_no,
      employee_count: result.org.employee_count,
      description: result.org.description,
      status: result.org.status,
      created_at: result.org.created_at,
    },
  };
};

export const loginUser = async (dto: LoginDto) => {
  const { email, password } = dto;

  // Regular org admin login
  const user = await User.findOne({
    where: { email },
    include: [{ model: Organization, as: 'organization' }],
  });

  if (!user) throw new Error('INVALID_CREDENTIALS');

  const passwordMatch = await verifyPassword(password, user.password_hash);
  if (!passwordMatch) throw new Error('INVALID_CREDENTIALS');

  // Check org status — org must be approved before anyone can log in
  const org = (user as any).organization as Organization;
  if (!org || org.status !== OrgStatus.ACTIVE) {
    throw new Error('ORG_NOT_APPROVED');
  }

  // Check user status
  if (user.status !== UserStatus.ACTIVE) {
    throw new Error('USER_NOT_ACTIVE');
  }

  const token = signToken({
    userId: Number(user.id),
    tenantId: user.tenant_id,
    roleId: user.role_id ? Number(user.role_id) : null,
    email: user.email,
    isSuperAdmin: false,
  });

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      tenant_id: user.tenant_id,
      status: user.status,
    },
  };
};
