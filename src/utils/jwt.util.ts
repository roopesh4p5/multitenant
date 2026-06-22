import jwt, { SignOptions } from 'jsonwebtoken';

export interface JwtPayload {
  userId: number;
  tenantId: string;
  roleId: number | null;
  email: string;
  isSuperAdmin: boolean;
}

const JWT_SECRET = process.env.JWT_SECRET as string;
const JWT_EXPIRES_IN = '7d';

export const signToken = (payload: JwtPayload): string => {
  if (!JWT_SECRET) throw new Error('JWT_SECRET is not set in environment');
  const options: SignOptions = { expiresIn: JWT_EXPIRES_IN };
  return jwt.sign(payload, JWT_SECRET, options);
};

export const verifyToken = (token: string): JwtPayload => {
  if (!JWT_SECRET) throw new Error('JWT_SECRET is not set in environment');
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
};
