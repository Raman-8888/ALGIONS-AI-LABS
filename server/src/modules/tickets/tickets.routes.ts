import { Router } from 'express';
import { TicketsController } from './tickets.controller.js';
import { requireAuth } from '../../common/middleware/auth.js';
import { requireRole } from '../../common/middleware/rbac.js';
import { validateRequest } from '../../common/validation/validate.js';
import { validateTicketSchema } from './tickets.validation.js';

export const ticketsRouter: Router = Router();

// Staff & Admin only: Validate tickets
ticketsRouter.post(
  '/validate',
  requireAuth,
  requireRole('STAFF', 'ADMIN'),
  validateRequest({ body: validateTicketSchema }),
  TicketsController.validate,
);

