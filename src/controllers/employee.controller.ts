import { Request, Response } from 'express';
import {
  signupEmployee,
  loginEmployee,
  getEmployeeProfile,
  updateEmployeeProfile,
} from '../services/employee-auth.service';
import { validateEmployeeData } from '../services/schema-validator.service';
import { getTenantIdFromRequest as getTenantFromRequest } from '../utils/tenant.util';

/**
 * Employee signup endpoint
 * POST /api/employee/signup
 *
 * Register a new employee within a tenant.
 * Email must be unique within the tenant.
 * Employee starts in PENDING status, awaiting admin approval.
 */
export const employeeSignup = async (req: Request, res: Response): Promise<void> => {
  const { email, password, name, phone, fieldValues } = req.body;

  if (!email || !password || !name) {
    res.status(400).json({
      success: false,
      message: 'email, password, and name are required',
    });
    return;
  }

  if (!fieldValues || typeof fieldValues !== 'object' || Array.isArray(fieldValues)) {
    res.status(400).json({
      success: false,
      message: 'fieldValues object is required and must be a plain object',
    });
    return;
  }

  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    res.status(400).json({ success: false, message: 'Invalid email format' });
    return;
  }

  // Password validation
  if (password.length < 8) {
    res.status(400).json({
      success: false,
      message: 'Password must be at least 8 characters',
    });
    return;
  }

  try {
    const tenantId = await getTenantFromRequest(req);

    const validationResult = await validateEmployeeData(fieldValues, tenantId);
    if (!validationResult.valid) {
      res.status(400).json({
        success: false,
        message: 'Signup field values do not match tenant schema',
        errors: validationResult.errors,
      });
      return;
    }

    const result = await signupEmployee(
      { email, password, name, phone },
      tenantId
    );

    res.status(201).json({
      success: true,
      data: result,
      message: 'Employee registered successfully. Awaiting admin approval.',
    });
  } catch (err: any) {
    if (err.message === 'TENANT_NOT_FOUND') {
      res.status(404).json({
        success: false,
        message: 'Tenant not found',
      });
      return;
    }
    if (err.message === 'TENANT_NOT_ACTIVE') {
      res.status(403).json({
        success: false,
        message: 'Tenant organization is not active',
      });
      return;
    }
    if (err.message === 'EMAIL_TAKEN_IN_TENANT') {
      res.status(409).json({
        success: false,
        message: 'Email is already registered with this organization',
      });
      return;
    }
    console.error('[employeeSignup]', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Employee login endpoint
 * POST /api/employee/login
 *
 * Authenticate an employee and return JWT token.
 * Employee must be in ACTIVE status and profile must be approved.
 */
export const employeeLogin = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({
      success: false,
      message: 'email and password are required',
    });
    return;
  }

  try {
    const tenantId = await getTenantFromRequest(req);

    const result = await loginEmployee({ email, password }, tenantId);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    if (err.message === 'INVALID_CREDENTIALS') {
      res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
      return;
    }
    if (err.message === 'USER_NOT_ACTIVE') {
      res.status(403).json({
        success: false,
        message: 'Your account has not been activated yet',
      });
      return;
    }
    if (err.message === 'PROFILE_NOT_APPROVED') {
      res.status(403).json({
        success: false,
        message: 'Your profile is pending admin approval',
      });
      return;
    }
    if (err.message === 'PROFILE_NOT_FOUND') {
      res.status(404).json({
        success: false,
        message: 'Employee profile not found',
      });
      return;
    }
    console.error('[employeeLogin]', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Get employee profile endpoint
 * GET /api/employee/profile
 *
 * Retrieve current authenticated employee's profile information.
 * Requires authentication.
 */
export const getProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }

    const result = await getEmployeeProfile(Number(req.user.userId), req.user.tenantId);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    if (err.message === 'EMPLOYEE_NOT_FOUND') {
      res.status(404).json({
        success: false,
        message: 'Employee not found',
      });
      return;
    }
    if (err.message === 'PROFILE_NOT_FOUND') {
      res.status(404).json({
        success: false,
        message: 'Profile not found',
      });
      return;
    }
    console.error('[getProfile]', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Update employee profile endpoint
 * PUT /api/employee/profile
 *
 * Update personal information (name, phone).
 * Schema fields are updated via schema API.
 * Requires authentication.
 */
export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  const { name, phone } = req.body;

  if (!name && !phone) {
    res.status(400).json({
      success: false,
      message: 'At least one field (name or phone) must be provided',
    });
    return;
  }

  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }

    const updates: { name?: string; phone?: string } = {};
    if (name) updates.name = name;
    if (phone) updates.phone = phone;

    const result = await updateEmployeeProfile(
      Number(req.user.userId),
      req.user.tenantId,
      updates
    );

    res.status(200).json({
      success: true,
      data: result,
      message: 'Profile updated successfully',
    });
  } catch (err: any) {
    if (err.message === 'EMPLOYEE_NOT_FOUND') {
      res.status(404).json({
        success: false,
        message: 'Employee not found',
      });
      return;
    }
    console.error('[updateProfile]', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Validate employee data against schema endpoint
 * POST /api/employee/validate
 *
 * Validates field values without saving them.
 * Used before bulk upload or form submission.
 * Requires authentication.
 */
export const validateData = async (req: Request, res: Response): Promise<void> => {
  const { fieldValues } = req.body;

  if (!fieldValues || typeof fieldValues !== 'object') {
    res.status(400).json({
      success: false,
      message: 'fieldValues object is required',
    });
    return;
  }

  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }

    const result = await validateEmployeeData(fieldValues, req.user.tenantId);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    console.error('[validateData]', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
