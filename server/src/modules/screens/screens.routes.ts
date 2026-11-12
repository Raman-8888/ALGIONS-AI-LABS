import { Router } from 'express';
import { ScreensController } from './screens.controller.js';
import { requireAuth } from '../../common/middleware/auth.js';
import { requireRole } from '../../common/middleware/rbac.js';
import { validateRequest } from '../../common/validation/validate.js';
import { createScreenSchema, updateScreenSchema } from './screens.validation.js';

export const screensRouter: Router = Router();

// Public: view screen layout
screensRouter.get('/:id', ScreensController.getById);

// Admin only: management
screensRouter.post(
  '/',
  requireAuth,
  requireRole('ADMIN'),
  validateRequest({ body: createScreenSchema }),
  ScreensController.create,
);

screensRouter.patch(
  '/:id',
  requireAuth,
  requireRole('ADMIN'),
  validateRequest({ body: updateScreenSchema }),
  ScreensController.update,
);

screensRouter.delete('/:id', requireAuth, requireRole('ADMIN'), ScreensController.delete);

