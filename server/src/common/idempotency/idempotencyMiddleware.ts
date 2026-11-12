import { Request, Response, NextFunction } from 'express';
import { IdempotencyKey } from '../../db/models/IdempotencyKey.js';
import { AppError } from '../errors/AppError.js';
import { computePayloadHash } from '../utils/index.js';

export function idempotencyGuard(options: { required?: boolean } = { required: true }) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const rawKey = req.headers['idempotency-key'];

    if (!rawKey) {
      if (options.required) {
        return next(
          AppError.badRequest('Idempotency-Key header is required for this operation', {
            header: 'Idempotency-Key',
          }),
        );
      }
      return next();
    }

    const key = Array.isArray(rawKey) ? rawKey[0] : rawKey;
    const userId = (req as any).user?.id;

    if (!userId) {
      return next(AppError.unauthorized('Authentication required to use Idempotency-Key'));
    }

    const requestHash = computePayloadHash(req.body);
    const requestPath = req.originalUrl.split('?')[0]; // Normalized path without query params
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h TTL

    try {
      // 1. Attempt atomic reservation with IN_PROGRESS status
      await IdempotencyKey.create({
        key,
        user: userId,
        requestPath,
        requestHash,
        status: 'IN_PROGRESS',
        expiresAt,
      });
    } catch (err: any) {
      // 2. Handle duplicate key collision
      if (err.code === 11000) {
        const existing = await IdempotencyKey.findOne({ key, user: userId });
        if (!existing) {
          return next(AppError.conflict('Concurrent idempotency reservation conflict'));
        }

        // Payload or endpoint path mismatch -> 422 Unprocessable
        if (existing.requestPath !== requestPath || existing.requestHash !== requestHash) {
          return next(
            AppError.unprocessable(
              'Idempotency key was previously used with a different request payload or endpoint',
              { key, path: requestPath },
            ),
          );
        }

        // Concurrent execution in progress -> 409 Conflict
        if (existing.status === 'IN_PROGRESS') {
          return next(
            AppError.conflict(
              'A request with this Idempotency-Key is currently processing. Please retry shortly.',
              { key },
            ),
          );
        }

        // Completed -> Replay stored response
        res.setHeader('X-Idempotent-Replay', 'true');
        return res.status(existing.responseStatus || 200).json(existing.responseBody);
      }
      return next(err);
    }

    // 3. Intercept response to store result on completion
    const originalJson = res.json.bind(res);
    res.json = function (body: any) {
      res.json = originalJson; // Restore original

      // Persist completed response asynchronously without blocking client
      IdempotencyKey.updateOne(
        { key, user: userId },
        {
          $set: {
            status: 'COMPLETED',
            responseStatus: res.statusCode,
            responseBody: body,
          },
        },
      ).catch((updateErr) => {
        console.error(`[Idempotency] Failed to mark key ${key} as COMPLETED:`, updateErr);
      });

      return originalJson(body);
    };

    next();
  };
}

