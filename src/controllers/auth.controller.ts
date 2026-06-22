import { Request, Response } from 'express';
import { registerOrgAdmin, loginUser } from '../services/auth.service';


export const register = async (req: Request, res: Response): Promise<void> => {
  const { org_name, gst_no,employee_count,description, admin_name, email, password, phone } = req.body;

  if (!org_name || !gst_no || !admin_name || !email || !password) {
    res.status(400).json({
      success: false,
      message: 'org_name, gst_no, admin_name, email, and password are required',
    });
    return;
  }

  // email check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    res.status(400).json({ success: false, message: 'Invalid email format' });
    return;
  }

  // password check
  if (password.length < 8) {
    res.status(400).json({
      success: false,
      message: 'Password must be at least 8 characters',
    });
    return;
  }

  try {
    const result = await registerOrgAdmin({
      org_name,
      gst_no,
      admin_name,
      employee_count,
      description,
      email,
      password,
      phone,
    });
    res.status(201).json({ success: true, data: result });
  } catch (err: any) {
    if (err.message === 'EMAIL_TAKEN') {
      res.status(409).json({ success: false, message: 'Email is already registered' });
      return;
    }
    if (err.message === 'GST_TAKEN') {
      res.status(409).json({
        success: false,
        message: 'An organization with this GST number already exists',
      });
      return;
    }
    if (err.message === 'ORG_SLUG_TAKEN') {
      res.status(409).json({
        success: false,
        message: 'An organization with this tenant URL already exists',
      });
      return;
    }
    if (err.message === 'INVALID_ORG_NAME') {
      res.status(400).json({
        success: false,
        message: 'Organization name must contain at least one letter or number',
      });
      return;
    }
    console.error('[register]', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};


export const login = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ success: false, message: 'email and password are required' });
    return;
  }

  try {
    const result = await loginUser({ email, password });
    res.status(200).json({ success: true, data: result });
  } catch (err: any) {
    if (err.message === 'INVALID_CREDENTIALS') {
      res.status(401).json({ success: false, message: 'Invalid email or password' });
      return;
    }
    if (err.message === 'ORG_NOT_APPROVED') {
      res.status(403).json({
        success: false,
        message: 'Your organization is pending superadmin approval. Please wait.',
      });
      return;
    }
    if (err.message === 'USER_NOT_ACTIVE') {
      res.status(403).json({
        success: false,
        message: 'Your account is not active. Contact your organization admin.',
      });
      return;
    }
    console.error('[login]', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
