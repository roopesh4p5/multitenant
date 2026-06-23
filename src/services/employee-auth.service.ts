import { v4 as uuidv4 } from 'uuid';
import { sequelize } from '../config/dbconfig';
import {
  User,
  UserStatus,
  EmployeeProfile,
  Organization,
} from '../models';
import { hashPassword, verifyPassword } from '../utils/password.util';
import { signToken } from '../utils/jwt.util';

export interface EmployeeSignupDto {
  email: string;
  password: string;
  name: string;
  phone?: string;
}

export interface EmployeeLoginDto {
  email: string;
  password: string;
}

/**
 * Employee signup — creates a new employee within a tenant.
 *
 * Flow:
 * 1. Verify tenant is active and approved
 * 2. Check email is unique within tenant
 * 3. Create user with PENDING status
 * 4. Create associated employee profile
 * 5. Return employee ID and status
 *
 * Note: Employee account creation doesn't grant immediate access.
 * Access is granted after admin approval (status → ACTIVE).
 */
export const signupEmployee = async (dto: EmployeeSignupDto, tenantId: string) => {
  const { email, password, name, phone } = dto;

  // Verify tenant exists and is active
  const tenant = await Organization.findOne({
    where: { tenant_id: tenantId },
  });

  if (!tenant) {
    throw new Error('TENANT_NOT_FOUND');
  }

  if (tenant.status !== 'active') {
    throw new Error('TENANT_NOT_ACTIVE');
  }

  // Check email uniqueness within tenant
  const existingEmployee = await User.findOne({
    where: {
      tenant_id: tenantId,
      email,
    },
  });

  if (existingEmployee) {
    throw new Error('EMAIL_TAKEN_IN_TENANT');
  }

  const password_hash = await hashPassword(password);

  const result = await sequelize.transaction(async (t) => {
    // Create user with PENDING status
    const user = await User.create(
      {
        tenant_id: tenantId,
        email,
        password_hash,
        name,
        phone: phone || null,
        status: UserStatus.PENDING,
        role_id: null, // Employee has no role initially
      },
      { transaction: t }
    );

    // Create associated employee profile
    const profile = await EmployeeProfile.create(
      {
        user_id: user.id,
        tenant_id: tenantId,
        approved_by: null,
        approved_at: null,
      },
      { transaction: t }
    );

    return {
      user_id: user.id,
      profile_id: profile.id,
      email: user.email,
      name: user.name,
      status: user.status,
      created_at: user.created_at,
    };
  });

  return result;
};

/**
 * Employee login — authenticates an employee and returns JWT token.
 *
 * Flow:
 * 1. Find employee by email within tenant
 * 2. Verify password
 * 3. Check employee status (must be ACTIVE)
 * 4. Check profile is approved
 * 5. Issue JWT token
 */
export const loginEmployee = async (
  dto: EmployeeLoginDto,
  tenantId: string
) => {
  const { email, password } = dto;

  const user = await User.findOne({
    where: {
      tenant_id: tenantId,
      email,
    },
  });

  if (!user) {
    throw new Error('INVALID_CREDENTIALS');
  }

  const isPasswordValid = await verifyPassword(password, user.password_hash);
  if (!isPasswordValid) {
    throw new Error('INVALID_CREDENTIALS');
  }

  // Check user status
  if (user.status !== UserStatus.ACTIVE) {
    throw new Error('USER_NOT_ACTIVE');
  }

  // Verify employee profile is approved
  const profile = await EmployeeProfile.findOne({
    where: { user_id: user.id },
  });

  if (!profile) {
    throw new Error('PROFILE_NOT_FOUND');
  }

  if (!profile.approved_at) {
    throw new Error('PROFILE_NOT_APPROVED');
  }

  // Generate JWT token
  const token = signToken({
    userId: user.id,
    tenantId: user.tenant_id,
    roleId: user.role_id || null,
    email: user.email,
    isSuperAdmin: false,
  });

  return {
    token,
    user: {
      user_id: Number(user.id),
      email: user.email,
      name: user.name,
      phone: user.phone,
      tenant_id: tenantId,
    },
  };
};

/**
 * Get employee profile with field values.
 * Validates that user belongs to the tenant making the request.
 */
export const getEmployeeProfile = async (
  employeeId: number,
  tenantId: string
) => {
  const user = await User.findOne({
    where: {
      id: employeeId,
      tenant_id: tenantId,
    },
  });

  if (!user) {
    throw new Error('EMPLOYEE_NOT_FOUND');
  }

  const profile = await EmployeeProfile.findOne({
    where: {
      user_id: employeeId,
      tenant_id: tenantId,
    },
  });

  if (!profile) {
    throw new Error('PROFILE_NOT_FOUND');
  }

  return {
    user_id: user.id,
    profile_id: profile.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    status: user.status,
    approved: profile.approved_at !== null,
    approved_at: profile.approved_at,
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
};

/**
 * Update employee profile (personal info only).
 * Does not update schema fields — use schema API for that.
 */
export const updateEmployeeProfile = async (
  employeeId: number,
  tenantId: string,
  updates: { name?: string; phone?: string }
) => {
  const user = await User.findOne({
    where: {
      id: employeeId,
      tenant_id: tenantId,
    },
  });

  if (!user) {
    throw new Error('EMPLOYEE_NOT_FOUND');
  }

  const updated = await user.update(updates);

  return {
    user_id: updated.id,
    email: updated.email,
    name: updated.name,
    phone: updated.phone,
    updated_at: updated.updated_at,
  };
};
