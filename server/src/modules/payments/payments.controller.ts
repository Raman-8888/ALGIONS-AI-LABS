import { Request, Response, NextFunction } from 'express';
import { PaymentsService } from './payments.service.js';

export class PaymentsController {
  static async simulate(req: Request, res: Response, next: NextFunction) {
    try {
      const payment = await PaymentsService.simulatePayment(req.user!.id, req.body, req.id);
      res.status(200).json({
        message: 'Payment processed successfully',
        data: { payment },
      });
    } catch (error) {
      next(error);
    }
  }
}

