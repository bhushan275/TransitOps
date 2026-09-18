import { NextFunction, Request, Response } from 'express';
import { Role } from '@prisma/client';
import { AppError } from '../utils/AppError';
import { JwtPayload, verifyToken } from '../utils/jwt';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/** Extracts a bearer token from the Authorization header or the auth cookie. */
function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    return header.slice('Bearer '.length).trim();
  }
  if (req.cookies?.token) {
    return req.cookies.token as string;
  }
  return null;
}

/** Requires a valid JWT; populates req.user. */
export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) {
    throw AppError.unauthorized('Authentication required');
  }
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    throw AppError.unauthorized('Invalid or expired token');
  }
}

/** Requires the authenticated user to hold one of the given roles. */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw AppError.unauthorized('Authentication required');
    }
    if (!roles.includes(req.user.role)) {
      throw AppError.forbidden(
        `This action requires one of the following roles: ${roles.join(', ')}`,
      );
    }
    next();
  };
}
