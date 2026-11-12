import rateLimit from 'express-rate-limit';
import { AppError } from '../errors/AppError.js';

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 attempts
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(
      AppError.tooManyRequests(
        'Too many authentication attempts from this IP, please try again after 15 minutes.',
      ),
    );
  },
});

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(AppError.tooManyRequests('API rate limit exceeded.'));
  },
});

