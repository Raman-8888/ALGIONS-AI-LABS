import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from './app.js';

describe('Base Application Health & Routing', () => {
  it('GET /health returns 200 ok status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('timestamp');
  });

  it('GET /api/v1 returns API root description', async () => {
    const res = await request(app).get('/api/v1');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'running');
  });

  it('GET unknown route returns consistent 404 error envelope', async () => {
    const res = await request(app).get('/unknown-endpoint');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toHaveProperty('code', 'NOT_FOUND');
    expect(res.body.error).toHaveProperty('message');
  });
});

