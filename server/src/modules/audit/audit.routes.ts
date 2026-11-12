import { Router } from 'express';
import { AuditController } from './audit.controller.js';
import { requireAuth } from '../../common/middleware/auth.js';
import { requireRole } from '../../common/middleware/rbac.js';
import { validateRequest } from '../../common/validation/validate.js';
import { auditQuerySchema } from './audit.validation.js';

export const auditRouter: Router = Router();

auditRouter.use(requireAuth);
auditRouter.use(requireRole('ADMIN'));

auditRouter.get(
  '/',
  validateRequest({ query: auditQuerySchema }),
  AuditController.list,
);

