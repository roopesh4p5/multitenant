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

// ─── DTOs ──────────────────────────────────────────────────────────────────

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

// ─── REGISTER ──────────────────────────────────────────────────────────────

/**
 * Registers a new organization along with its first admin user.
 *
 * Transaction steps:
 *  1. Check email not already in use globally (prevent confusion)
 *  2. Check GST not already registered
 *  3. Generate tenant_id (UUID)
 *  4. Create Organization (status = inactive — awaiting superadmin approval)
 *  5. Seed an "org_admin" system role for this tenant
 *  6. Create User (status = pending, password hashed)
 *
 * The org admin CANNOT log in until:
 *   - SuperAdmin approves the org (sets org.status = active)
 *   - And user.status is set to active as part of approval
 */
export const registerOrgAdmin = async (dto: RegisterOrgAdminDto) => {
  const { org_name, gst_no, admin_name, email, password, phone, employee_count, description } = dto;

  // Pre-flight checks outside transaction to give clear errors
  const existingEmail = await User.findOne({ where: { email } });
  if (existingEmail) {
    throw new Error('EMAIL_TAKEN');
  }

  const existingGst = await Organization.findOne({ where: { gst_no } });
  if (existingGst) {
    throw new Error('GST_TAKEN');
  }

  const tenant_id = uuidv4();
  const password_hash = await hashPassword(password);

  const result = await sequelize.transaction(async (t) => {
    // Step 1: Create the organization (inactive until superadmin approves)
    const org = await Organization.create(
      {
        tenant_id,
        org_name,
        gst_no,
        status: OrgStatus.INACTIVE,
        employee_count: typeof employee_count === 'number' ? employee_count : 0,
        description: description ?? null,
      },
      { transaction: t }
    );

    // Step 2: Seed the org_admin role for this tenant
    const role = await Role.create(
      {
        tenant_id,
        role_name: 'org_admin',
        description: 'Organization administrator — full access within the tenant',
        is_system_role: true,
      },
      { transaction: t }
    );

    // Step 3: Create the admin user (pending — tied to org approval)
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
      gst_no: result.org.gst_no,
      employee_count: result.org.employee_count,
      description: result.org.description,
      status: result.org.status,
      created_at: result.org.created_at,
    },
  };
};

// ─── LOGIN ─────────────────────────────────────────────────────────────────

/**
 * Login with email + password.
 *
 * Guards (in order):
 *   1. User must exist
 *   2. Password must match
 *   3. Organization must be active (approved by superadmin)
 *   4. User must be active
 *
 * SuperAdmin login: if email matches SUPERADMIN_EMAIL env var, skip org checks
 * and return a token with isSuperAdmin = true.
 */
export const loginUser = async (dto: LoginDto) => {
  const { email, password } = dto;

  // Superadmin shortcut — env-based identity for Phase 1 simplicity
  const superAdminEmail = process.env.SUPERADMIN_EMAIL;
  const superAdminPassword = process.env.SUPERADMIN_PASSWORD;

  if (superAdminEmail && email === superAdminEmail) {
    if (!superAdminPassword || password !== superAdminPassword) {
      throw new Error('INVALID_CREDENTIALS');
    }
    const token = signToken({
      userId: 0,
      tenantId: 'system',
      roleId: null,
      email: superAdminEmail,
      isSuperAdmin: true,
    });
    return { token, isSuperAdmin: true };
  }

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
