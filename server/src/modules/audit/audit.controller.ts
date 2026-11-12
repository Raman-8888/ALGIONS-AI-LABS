import { Request, Response, NextFunction } from 'express';
import { AuditService } from './audit.service.js';

export class AuditController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AuditService.listLogs(req.query as any);
      res.status(200).json({ data: result });
    } catch (error) {
      next(error);
    }
  }
}

