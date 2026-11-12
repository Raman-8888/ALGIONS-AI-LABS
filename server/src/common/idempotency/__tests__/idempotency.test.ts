import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import { setupTestDb, teardownTestDb, clearTestDb } from '../../../test/setup.js';
import { idempotencyGuard } from '../idempotencyMiddleware.js';
import { IdempotencyKey } from '../../../db/models/IdempotencyKey.js';
import { errorHandler } from '../../middleware/errorHandler.js';

describe('Idempotency Infrastructure', () => {
  let testApp: express.Express;

  beforeAll(async () => {
    await setupTestDb();
    await IdempotencyKey.init();

    testApp = express();
    testApp.use(cookieParser('secret'));
    testApp.use(express.json());

    // Mock authentication user
    testApp.use((req, _res, next) => {
      (req as any).user = { id: '60d5ecb8b5c9c82b88b22a11', role: 'CUSTOMER' };
      next();
    });

    // Test route with idempotency guard
    testApp.post(
      '/test-payment',
      idempotencyGuard({ required: true }),
      (req, res) => {
        res.status(200).json({
          success: true,
          amountPaid: req.body.amount,
          processedAt: new Date().toISOString(),
        });
      },
    );

    testApp.use(errorHandler);
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
  });

  it('rejects request if Idempotency-Key header is missing', async () => {
    const res = await request(testApp)
      .post('/test-payment')
      .send({ amount: 500 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('executes initially, and replays cached response for identical subsequent requests', async () => {
    const key = 'idem-key-001';
    const payload = { amount: 500 };

    // 1st request
    const firstRes = await request(testApp)
      .post('/test-payment')
      .set('Idempotency-Key', key)
      .send(payload);

    expect(firstRes.status).toBe(200);
    expect(firstRes.body.success).toBe(true);
    expect(firstRes.headers['x-idempotent-replay']).toBeUndefined();

    // Small delay to ensure DB write finishes
    await new Promise((resolve) => setTimeout(resolve, 50));

    // 2nd request: identical key and payload
    const secondRes = await request(testApp)
      .post('/test-payment')
      .set('Idempotency-Key', key)
      .send(payload);

    expect(secondRes.status).toBe(200);
    expect(secondRes.headers['x-idempotent-replay']).toBe('true');
    expect(secondRes.body.amountPaid).toBe(firstRes.body.amountPaid);
    expect(secondRes.body.processedAt).toBe(firstRes.body.processedAt);
  });

  it('rejects with 422 if same key is sent with different payload', async () => {
    const key = 'idem-key-002';

    // 1st request with amount 500
    await request(testApp)
      .post('/test-payment')
      .set('Idempotency-Key', key)
      .send({ amount: 500 });

    await new Promise((resolve) => setTimeout(resolve, 50));

    // 2nd request with amount 1000 (payload tampering)
    const secondRes = await request(testApp)
      .post('/test-payment')
      .set('Idempotency-Key', key)
      .send({ amount: 1000 });

    expect(secondRes.status).toBe(422);
    expect(secondRes.body.error.code).toBe('UNPROCESSABLE_ENTITY');
  });
});

