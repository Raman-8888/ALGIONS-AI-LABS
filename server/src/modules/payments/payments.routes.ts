import { Router } from 'express';
import { PaymentsController } from './payments.controller.js';
import { requireAuth } from '../../common/middleware/auth.js';
import { validateRequest } from '../../common/validation/validate.js';
import { idempotencyGuard } from '../../common/idempotency/idempotencyMiddleware.js';
import { simulatePaymentSchema } from './payments.validation.js';

export const paymentsRouter: Router = Router();

paymentsRouter.use(requireAuth);

paymentsRouter.post(
  '/simulate',
  idempotencyGuard({ required: true }),
  validateRequest({ body: simulatePaymentSchema }),
  PaymentsController.simulate,
);

