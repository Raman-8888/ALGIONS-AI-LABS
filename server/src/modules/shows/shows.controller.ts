import { Request, Response, NextFunction } from 'express';
import { ShowsService } from './shows.service.js';

export class ShowsController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const shows = await ShowsService.listShows(req.query as any);
      res.status(200).json({ data: { shows } });
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const show = await ShowsService.getShowById(req.params.id);
      res.status(200).json({ data: { show } });
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const show = await ShowsService.createShow(req.body, req.user!.id, req.id);
      res.status(201).json({
        message: 'Show created and seats generated successfully',
        data: { show },
      });
    } catch (error) {
      next(error);
    }
  }

  static async cancel(req: Request, res: Response, next: NextFunction) {
    try {
      const show = await ShowsService.cancelShow(req.params.id, req.user!.id, req.id);
      res.status(200).json({
        message: 'Show cancelled and affected bookings/tickets refunded successfully',
        data: { show },
      });
    } catch (error) {
      next(error);
    }
  }
}

