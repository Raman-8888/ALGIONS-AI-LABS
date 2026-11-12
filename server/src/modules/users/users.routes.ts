import { Router } from 'express';
import { UsersController } from './users.controller.js';
import { requireAuth } from '../../common/middleware/auth.js';
import { requireRole } from '../../common/middleware/rbac.js';
import { validateRequest } from '../../common/validation/validate.js';
import { updateRoleSchema } from './users.validation.js';

export const usersRouter: Router = Router();

usersRouter.use(requireAuth);
usersRouter.use(requireRole('ADMIN'));

usersRouter.get('/', UsersController.listUsers);
usersRouter.patch(
  '/:id/role',
  validateRequest({ body: updateRoleSchema }),
  UsersController.updateRole,
);

