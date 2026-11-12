import { Router } from 'express';
import { ShowsController } from './shows.controller.js';
import { requireAuth } from '../../common/middleware/auth.js';
import { requireRole } from '../../common/middleware/rbac.js';
import { validateRequest } from '../../common/validation/validate.js';
import { createShowSchema, showQuerySchema } from './shows.validation.js';

export const showsRouter: Router = Router();

// Public: customer show discovery
showsRouter.get('/', validateRequest({ query: showQuerySchema }), ShowsController.list);
showsRouter.get('/:id', ShowsController.getById);

// Admin only: show creation & cascade cancellation
showsRouter.post(
  '/',
  requireAuth,
  requireRole('ADMIN'),
  validateRequest({ body: createShowSchema }),
  ShowsController.create,
);

showsRouter.post(
  '/:id/cancel',
  requireAuth,
  requireRole('ADMIN'),
  ShowsController.cancel,
);

