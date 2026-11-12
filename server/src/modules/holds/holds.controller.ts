import { Request, Response, NextFunction } from 'express';
import { HoldsService } from './holds.service.js';

export class HoldsController {
  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await HoldsService.createHold(req.user!.id, req.body, req.id);
      res.status(201).json({
        message: 'Seats held successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async release(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await HoldsService.releaseHold(req.user!.id, req.body, req.id);
      res.status(200).json({
        message: 'Seats released successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getActive(req: Request, res: Response, next: NextFunction) {
    try {
      const showId = req.query.showId as string;
      const holds = await HoldsService.getActiveHolds(req.user!.id, showId);
      res.status(200).json({ data: { holds } });
    } catch (error) {
      next(error);
    }
  }
}

