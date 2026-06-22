import { Request, Response, NextFunction } from 'express';
import { verifyToken, JwtPayload } from '../utils/jwt.util';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'No token provided' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};


export const requireSuperAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user?.isSuperAdmin) {
    res.status(403).json({ success: false, message: 'Superadmin access required' });
    return;
  }
  next();
};

export const requireTenant = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Authentication required' });
    return;
  }

  if (req.user.isSuperAdmin || !req.user.tenantId || req.user.tenantId === 'system') {
    res.status(403).json({ success: false, message: 'Tenant access required' });
    return;
  }

  next();
};

export const restrictTenantAccess = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Authentication required' });
    return;
  }

  if (req.user.isSuperAdmin) {
    next();
    return;
  }

  const requestedTenantId =
    req.params.tenant_id ??
    req.params.tenantId ??
    req.query.tenant_id ??
    req.query.tenantId ??
    req.body?.tenant_id ??
    req.body?.tenantId;

  if (requestedTenantId && String(requestedTenantId) !== req.user.tenantId) {
    res.status(403).json({ success: false, message: 'Cross-tenant access denied' });
    return;
  }

  next();
};
