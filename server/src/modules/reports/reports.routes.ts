import { Router } from 'express';
import { ReportsController } from './reports.controller.js';
import { requireAuth } from '../../common/middleware/auth.js';
import { requireRole } from '../../common/middleware/rbac.js';
import { validateRequest } from '../../common/validation/validate.js';
import { reportQuerySchema } from './reports.validation.js';

export const reportsRouter: Router = Router();

reportsRouter.use(requireAuth);
reportsRouter.use(requireRole('ADMIN'));

reportsRouter.get(
  '/occupancy',
  validateRequest({ query: reportQuerySchema }),
  ReportsController.getOccupancy,
);

reportsRouter.get(
  '/sales',
  validateRequest({ query: reportQuerySchema }),
  ReportsController.getSales,
);

