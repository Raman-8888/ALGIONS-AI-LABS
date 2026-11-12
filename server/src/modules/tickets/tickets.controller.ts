import { Request, Response, NextFunction } from 'express';
import { TicketsService } from './tickets.service.js';

export class TicketsController {
  static async validate(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await TicketsService.validateTicket(req.user!, req.body, req.id);
      res.status(200).json({
        message: 'Ticket successfully verified and marked as USED',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

