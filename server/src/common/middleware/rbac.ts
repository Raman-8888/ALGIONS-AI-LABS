import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../../db/models/User.js';
import { AppError } from '../errors/AppError.js';

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(AppError.unauthorized('Authentication required'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        AppError.forbidden(
          `Access denied. Role "${req.user.role}" does not have permission for this resource. Required: [${allowedRoles.join(', ')}]`,
          {
            userRole: req.user.role,
            requiredRoles: allowedRoles,
          },
        ),
      );
    }

    next();
  };
}

