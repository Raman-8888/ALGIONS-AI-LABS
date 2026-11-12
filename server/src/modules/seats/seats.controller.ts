import { Request, Response, NextFunction } from 'express';
import { SeatsService } from './seats.service.js';

export class SeatsController {
  static async getSeatMap(req: Request, res: Response, next: NextFunction) {
    try {
      const showId = req.params.showId;
      const currentUserId = req.user?.id;

      const result = await SeatsService.getShowSeatMap(showId, currentUserId);
      res.status(200).json({ data: result });
    } catch (error) {
      next(error);
    }
  }
}

