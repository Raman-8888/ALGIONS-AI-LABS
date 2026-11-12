import { Router } from 'express';
import { AuthController } from './auth.controller.js';
import { validateRequest } from '../../common/validation/validate.js';
import { registerSchema, loginSchema } from './auth.validation.js';
import { requireAuth } from '../../common/middleware/auth.js';
import { authLimiter } from '../../common/middleware/rateLimiter.js';

export const authRouter: Router = Router();

authRouter.post(
  '/register',
  authLimiter,
  validateRequest({ body: registerSchema }),
  AuthController.register,
);

authRouter.post(
  '/login',
  authLimiter,
  validateRequest({ body: loginSchema }),
  AuthController.login,
);

authRouter.post('/logout', AuthController.logout);

authRouter.get('/me', requireAuth, AuthController.me);

