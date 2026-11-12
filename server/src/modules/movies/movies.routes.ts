import { Router } from 'express';
import { MoviesController } from './movies.controller.js';
import { requireAuth } from '../../common/middleware/auth.js';
import { requireRole } from '../../common/middleware/rbac.js';
import { validateRequest } from '../../common/validation/validate.js';
import {
  createMovieSchema,
  updateMovieSchema,
  movieQuerySchema,
} from './movies.validation.js';

export const moviesRouter: Router = Router();

// Public: discovery & search
moviesRouter.get('/', validateRequest({ query: movieQuerySchema }), MoviesController.list);
moviesRouter.get('/:id', MoviesController.getById);

// Admin only: catalog management
moviesRouter.post(
  '/',
  requireAuth,
  requireRole('ADMIN'),
  validateRequest({ body: createMovieSchema }),
  MoviesController.create,
);

moviesRouter.patch(
  '/:id',
  requireAuth,
  requireRole('ADMIN'),
  validateRequest({ body: updateMovieSchema }),
  MoviesController.update,
);

moviesRouter.delete('/:id', requireAuth, requireRole('ADMIN'), MoviesController.delete);

