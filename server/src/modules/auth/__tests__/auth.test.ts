import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../../app.js';
import { setupTestDb, teardownTestDb, clearTestDb } from '../../../test/setup.js';
import { User } from '../../../db/models/User.js';
import { AuditLog } from '../../../db/models/AuditLog.js';

describe('Auth & RBAC Module', () => {
  beforeAll(async () => {
    await setupTestDb();
    await User.init();
    await AuditLog.init();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
  });

  describe('POST /api/v1/auth/register', () => {
    it('registers a customer successfully and sets httpOnly cookie with role=CUSTOMER', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'customer@example.com',
          password: 'Password123!',
          name: 'Jane Doe',
          role: 'ADMIN', // Attacker attempt to elevate privileges
        });

      expect(res.status).toBe(201);
      expect(res.body.data.user).toMatchObject({
        email: 'customer@example.com',
        name: 'Jane Doe',
        role: 'CUSTOMER', // Server MUST enforce CUSTOMER
      });

      // Verify cookie
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toContain('access_token=');
      expect(cookies[0]).toContain('HttpOnly');

      // Verify AuditLog
      const audit = await AuditLog.findOne({ action: 'USER_REGISTER' });
      expect(audit).not.toBeNull();
      expect(audit?.entityId).toBe(res.body.data.user.id);
    });

    it('rejects duplicate email with 409 Conflict', async () => {
      await request(app).post('/api/v1/auth/register').send({
        email: 'duplicate@example.com',
        password: 'Password123!',
        name: 'Original User',
      });

      const res = await request(app).post('/api/v1/auth/register').send({
        email: 'DUPLICATE@example.com',
        password: 'Password123!',
        name: 'Duplicate Attempt',
      });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('rejects invalid password format with 422 Unprocessable Entity', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        email: 'weak@example.com',
        password: 'weak', // Missing uppercase, number, symbol
        name: 'Weak Password',
      });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
      expect(res.body.error.details.fieldErrors.length).toBeGreaterThan(0);
    });
  });

  describe('POST /api/v1/auth/login & /me', () => {
    beforeEach(async () => {
      await request(app).post('/api/v1/auth/register').send({
        email: 'active@example.com',
        password: 'Password123!',
        name: 'Active User',
      });
    });

    it('logs in successfully and allows accessing /me', async () => {
      const loginRes = await request(app).post('/api/v1/auth/login').send({
        email: 'active@example.com',
        password: 'Password123!',
      });

      expect(loginRes.status).toBe(200);
      const cookie = loginRes.headers['set-cookie'];

      const meRes = await request(app)
        .get('/api/v1/auth/me')
        .set('Cookie', cookie);

      expect(meRes.status).toBe(200);
      expect(meRes.body.data.user.email).toBe('active@example.com');
    });

    it('rejects wrong password with 401 Unauthorized', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'active@example.com',
        password: 'WrongPassword!',
      });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects deactivated user with 403 Forbidden', async () => {
      await User.updateOne({ email: 'active@example.com' }, { $set: { isActive: false } });

      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'active@example.com',
        password: 'Password123!',
      });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('logout clears the access_token cookie', async () => {
      const res = await request(app).post('/api/v1/auth/logout');
      expect(res.status).toBe(200);
      const cookies = res.headers['set-cookie'];
      expect(cookies[0]).toMatch(/access_token=;/);
    });
  });

  describe('RBAC Middleware', () => {
    let customerCookie: string[];
    let adminCookie: string[];

    beforeEach(async () => {
      // Create Customer
      const custRes = await request(app).post('/api/v1/auth/register').send({
        email: 'cust@example.com',
        password: 'Password123!',
        name: 'Customer',
      });
      customerCookie = custRes.headers['set-cookie'];

      // Create Admin directly
      const adminUser = await User.create({
        email: 'admin@example.com',
        passwordHash: 'dummy',
        name: 'Admin',
        role: 'ADMIN',
      });

      // Login Admin
      const adminRes = await request(app).post('/api/v1/auth/login').send({
        email: 'admin@example.com',
        password: 'Password123!',
      });

      // Update password hash properly
      const bcrypt = await import('bcryptjs');
      adminUser.passwordHash = await bcrypt.default.hash('Password123!', 10);
      await adminUser.save();

      const adminLoginRes = await request(app).post('/api/v1/auth/login').send({
        email: 'admin@example.com',
        password: 'Password123!',
      });
      adminCookie = adminLoginRes.headers['set-cookie'];
    });

    it('blocks CUSTOMER from accessing ADMIN /api/v1/users with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/v1/users')
        .set('Cookie', customerCookie);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('allows ADMIN to access /api/v1/users', async () => {
      const res = await request(app)
        .get('/api/v1/users')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.users.length).toBeGreaterThan(0);
    });
  });
});

