import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { AppError } from '../errors/AppError.js';
import { User, UserRole } from '../../db/models/User.js';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  tokenVersion: number;
}

function extractToken(req: Request): string | undefined {
  if (req.cookies && req.cookies[config.jwt.cookieName]) {
    return req.cookies[config.jwt.cookieName];
  }
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }
  return undefined;
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = extractToken(req);

  if (!token) {
    return next(AppError.unauthorized('Authentication required: no token provided'));
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;

    const user = await User.findById(decoded.sub).lean();
    if (!user) {
      return next(AppError.unauthorized('User associated with this token no longer exists'));
    }

    if (!user.isActive) {
      return next(AppError.forbidden('This user account has been deactivated'));
    }

    if (user.tokenVersion !== decoded.tokenVersion) {
      return next(AppError.unauthorized('Session has expired or was revoked. Please log in again.'));
    }

    req.user = {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return next(AppError.unauthorized('Token expired. Please log in again.'));
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return next(AppError.unauthorized('Invalid authentication token'));
    }
    next(error);
  }
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
    const user = await User.findById(decoded.sub).lean();
    if (user && user.isActive && user.tokenVersion === decoded.tokenVersion) {
      req.user = {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
      };
    }
  } catch {
    // Silently ignore invalid tokens in optionalAuth
  }

  next();
}
