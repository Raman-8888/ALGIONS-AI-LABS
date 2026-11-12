import { Router } from 'express';
import { TheatresController } from './theatres.controller.js';
import { requireAuth } from '../../common/middleware/auth.js';
import { requireRole } from '../../common/middleware/rbac.js';
import { validateRequest } from '../../common/validation/validate.js';
import { createTheatreSchema, updateTheatreSchema } from './theatres.validation.js';

export const theatresRouter: Router = Router();

// Public: discovery
theatresRouter.get('/', TheatresController.list);
theatresRouter.get('/:id', TheatresController.getById);

// Admin only: management
theatresRouter.post(
  '/',
  requireAuth,
  requireRole('ADMIN'),
  validateRequest({ body: createTheatreSchema }),
  TheatresController.create,
);

theatresRouter.patch(
  '/:id',
  requireAuth,
  requireRole('ADMIN'),
  validateRequest({ body: updateTheatreSchema }),
  TheatresController.update,
);

theatresRouter.delete('/:id', requireAuth, requireRole('ADMIN'), TheatresController.delete);

