import { Router } from 'express';
import { HoldsController } from './holds.controller.js';
import { requireAuth } from '../../common/middleware/auth.js';
import { validateRequest } from '../../common/validation/validate.js';
import { idempotencyGuard } from '../../common/idempotency/idempotencyMiddleware.js';
import { createHoldSchema, releaseHoldSchema } from './holds.validation.js';

export const holdsRouter: Router = Router();

// All hold actions require authentication
holdsRouter.use(requireAuth);

// Create Hold (Requires Idempotency-Key)
holdsRouter.post(
  '/',
  idempotencyGuard({ required: true }),
  validateRequest({ body: createHoldSchema }),
  HoldsController.create,
);

// Release Hold
holdsRouter.delete(
  '/',
  validateRequest({ body: releaseHoldSchema }),
  HoldsController.release,
);

// Get Active Holds for user
holdsRouter.get('/active', HoldsController.getActive);

