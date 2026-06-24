import { Request, Response } from 'express';
import {
  signupEmployee,
  loginEmployee,
  getEmployeeProfile,
} from '../services/employee-auth.service';
import { validateEmployeeData } from '../services/schema-validator.service';
import { getTenantIdFromRequest as getTenantFromRequest } from '../utils/tenant.util';


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

  // check email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    res.status(400).json({ success: false, message: 'Invalid email format' });
    return;
  }

  // check password
  if (password.length < 8) {
    res.status(400).json({
      success: false,
      message: 'Password must be at least 8 characters',
    });
    return;
  }

  try {
    const tenantId = await getTenantFromRequest(req);
    console.log('[employeeSignup] tenant', tenantId, 'email', email);

    const validationResult = await validateEmployeeData(fieldValues, tenantId);
    if (!validationResult.valid) {
      console.log('[employeeSignup] validation failed', validationResult.errors);
      res.status(400).json({
        success: false,
        message: 'Signup field values do not match tenant schema',
        errors: validationResult.errors,
      });
      return;
    }

    const result = await signupEmployee(
      { email, password, name, phone, fieldValues },
      tenantId
    );

    res.status(201).json({
      success: true,
      data: result,
      message: 'Employee registered successfully.',
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
    if (err.message === 'INVALID_FIELD_VALUES') {
      res.status(400).json({
        success: false,
        message: 'fieldValues must be a non-empty object',
      });
      return;
    }
    if (err.message === 'SCHEMA_VALIDATION_FAILED') {
      res.status(400).json({
        success: false,
        message: 'Signup field values do not match tenant schema',
        errors: err.validationErrors || [],
      });
      return;
    }
    if (typeof err.message === 'string' && err.message.startsWith('UNKNOWN_SCHEMA_FIELD:')) {
      res.status(400).json({
        success: false,
        message: 'Signup contains a field that is not defined in tenant schema',
        field: err.message.replace('UNKNOWN_SCHEMA_FIELD:', ''),
      });
      return;
    }
    console.error('[employeeSignup]', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};


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
    console.log('[employeeLogin] tenant', tenantId, 'email', email);

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
    // PROFILE_NOT_APPROVED handling removed since employees are active immediately
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


export const getProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }

    console.log('[getProfile] user', req.user.userId, 'tenant', req.user.tenantId);
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


