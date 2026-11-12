import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError.js';

export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  const requestId = req.id || (req.headers['x-request-id'] as string) || 'system';

  // 1. Handle Known Operational AppErrors
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
        requestId,
      },
    });
  }

  // 2. Handle MongoDB Duplicate Key (E11000)
  if ((err as any).code === 11000) {
    const field = Object.keys((err as any).keyValue || {})[0] || 'resource';
    return res.status(409).json({
      error: {
        code: 'CONFLICT',
        message: `Duplicate entry: a resource with that ${field} already exists.`,
        details: (err as any).keyValue,
        requestId,
      },
    });
  }

  // 3. Handle Mongoose CastError (invalid ObjectId)
  if ((err as any).name === 'CastError') {
    return res.status(400).json({
      error: {
        code: 'BAD_REQUEST',
        message: `Invalid identifier format: ${(err as any).value}`,
        requestId,
      },
    });
  }

  // 4. Fallback for Unexpected / Internal Errors
  console.error(`[Unhandled Error] [${requestId}]:`, err);
  return res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected internal server error occurred',
      requestId,
    },
  });
}

