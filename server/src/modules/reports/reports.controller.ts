import { Request, Response, NextFunction } from 'express';
import { ReportsService } from './reports.service.js';

export class ReportsController {
  static async getOccupancy(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await ReportsService.getOccupancyReport(req.query as any);
      res.status(200).json({ data });
    } catch (error) {
      next(error);
    }
  }

  static async getSales(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await ReportsService.getSalesReport(req.query as any);
      res.status(200).json({ data });
    } catch (error) {
      next(error);
    }
  }
}

