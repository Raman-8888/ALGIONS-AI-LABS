import { Request, Response, NextFunction } from 'express';
import { BookingsService } from './bookings.service.js';

export class BookingsController {
  static async checkout(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await BookingsService.checkout(req.user!.id, req.body, req.id);
      res.status(201).json({
        message: 'Booking confirmed successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async initiate(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await BookingsService.initiateBooking(req.user!.id, req.body, req.id);
      res.status(201).json({
        message: 'Booking initiated, ready for payment',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async confirm(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { paymentId } = req.body;
      const result = await BookingsService.confirmBooking(req.user!.id, id, paymentId, req.id);
      res.status(200).json({
        message: 'Booking confirmed successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getMyBookings(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 10;
      const result = await BookingsService.getMyBookings(req.user!.id, page, limit);
      res.status(200).json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const booking = await BookingsService.getBookingById(req.user!.id, req.params.id);
      res.status(200).json({ data: { booking } });
    } catch (error) {
      next(error);
    }
  }
}

