import { Request, Response, NextFunction } from 'express';
import { User } from '../../db/models/User.js';
import { AppError } from '../../common/errors/AppError.js';
import { logAudit } from '../../common/audit/auditLogger.js';

export class UsersController {
  static async updateRole(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { role } = req.body;

      const user = await User.findById(id);
      if (!user) {
        throw AppError.notFound(`User with id ${id} not found`);
      }

      const previousRole = user.role;
      user.role = role;
      user.tokenVersion += 1; // Invalidate existing sessions on role change
      await user.save();

      await logAudit({
        actorType: 'USER',
        actorId: req.user!.id,
        action: 'ROLE_CHANGE',
        entity: 'User',
        entityId: user._id.toString(),
        details: {
          previousRole,
          newRole: role,
          targetUserEmail: user.email,
        },
        requestId: req.id,
      });

      res.status(200).json({
        message: 'User role updated successfully',
        data: {
          user: {
            id: user._id.toString(),
            email: user.email,
            name: user.name,
            role: user.role,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async listUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 10));
      const skip = (page - 1) * limit;

      const [users, total] = await Promise.all([
        User.find({}, '-passwordHash')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        User.countDocuments(),
      ]);

      res.status(200).json({
        data: {
          users,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

