import { Router } from 'express';
import { SeatsController } from './seats.controller.js';
import { optionalAuth } from '../../common/middleware/auth.js';

export const seatsRouter: Router = Router();

// Public / Authenticated: Live seat map with lazy expiry resolution
seatsRouter.get('/show/:showId', optionalAuth, SeatsController.getSeatMap);
seatsRouter.get('/:showId', optionalAuth, SeatsController.getSeatMap);

