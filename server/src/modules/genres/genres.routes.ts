import { Router } from 'express';
import { GenresController } from './genres.controller.js';
import { requireAuth } from '../../common/middleware/auth.js';
import { requireRole } from '../../common/middleware/rbac.js';
import { validateRequest } from '../../common/validation/validate.js';
import { createGenreSchema } from './genres.validation.js';

export const genresRouter: Router = Router();

// Public: browse genres
genresRouter.get('/', GenresController.list);

// Admin only: create & delete genres
genresRouter.post(
  '/',
  requireAuth,
  requireRole('ADMIN'),
  validateRequest({ body: createGenreSchema }),
  GenresController.create,
);

genresRouter.delete('/:id', requireAuth, requireRole('ADMIN'), GenresController.delete);

