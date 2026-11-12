import { Router } from 'express';
import { BookingsController } from './bookings.controller.js';
import { requireAuth } from '../../common/middleware/auth.js';
import { validateRequest } from '../../common/validation/validate.js';
import { idempotencyGuard } from '../../common/idempotency/idempotencyMiddleware.js';
import {
  initiateBookingSchema,
  checkoutSchema,
  confirmBookingSchema,
  cancelBookingSchema,
} from './bookings.validation.js';

export const bookingsRouter: Router = Router();

bookingsRouter.use(requireAuth);

// All-in-one idempotent checkout (initiate -> simulate payment -> confirm)
bookingsRouter.post(
  '/checkout',
  idempotencyGuard({ required: true }),
  validateRequest({ body: checkoutSchema }),
  BookingsController.checkout,
);

// Modular Step 1: Initiate booking
bookingsRouter.post(
  '/initiate',
  validateRequest({ body: initiateBookingSchema }),
  BookingsController.initiate,
);

// Modular Step 3: Confirm booking
bookingsRouter.post(
  '/:id/confirm',
  idempotencyGuard({ required: true }),
  validateRequest({ body: confirmBookingSchema }),
  BookingsController.confirm,
);

// Customer booking cancellation (Requires Idempotency-Key)
bookingsRouter.post(
  '/:id/cancel',
  idempotencyGuard({ required: true }),
  validateRequest({ body: cancelBookingSchema }),
  BookingsController.cancel,
);

// Customer booking history
bookingsRouter.get('/my-bookings', BookingsController.getMyBookings);
bookingsRouter.get('/:id', BookingsController.getById);

