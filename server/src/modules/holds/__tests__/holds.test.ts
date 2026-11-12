import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../../../app.js';
import { setupTestDb, teardownTestDb, clearTestDb } from '../../../test/setup.js';
import {
  User,
  Movie,
  Theatre,
  Screen,
  Show,
  ShowSeat,
  AuditLog,
  IdempotencyKey,
} from '../../../db/models/index.js';
import { HoldSweeper } from '../holdSweeper.js';

describe('Seat Holds, Concurrency & Expiry Engine (Phase 6)', () => {
  let userACookie: string[];
  let userBCookie: string[];
  let userA: any;
  let userB: any;
  let testMovie: any;
  let testTheatre: any;
  let testScreen: any;
  let testShow: any;
  let seatA2: any;
  let seatA3: any;
  let seatA4: any;

  beforeAll(async () => {
    await setupTestDb();
    await Promise.all([
      User.init(),
      Movie.init(),
      Theatre.init(),
      Screen.init(),
      Show.init(),
      ShowSeat.init(),
      AuditLog.init(),
      IdempotencyKey.init(),
    ]);
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();

    // 1. Create Users
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('Password123!', salt);

    userA = await User.create({
      email: 'usera@example.com',
      passwordHash,
      name: 'User A',
      role: 'CUSTOMER',
    });

    userB = await User.create({
      email: 'userb@example.com',
      passwordHash,
      name: 'User B',
      role: 'CUSTOMER',
    });

    const loginResA = await request(app).post('/api/v1/auth/login').send({
      email: 'usera@example.com',
      password: 'Password123!',
    });
    userACookie = loginResA.headers['set-cookie'];

    const loginResB = await request(app).post('/api/v1/auth/login').send({
      email: 'userb@example.com',
      password: 'Password123!',
    });
    userBCookie = loginResB.headers['set-cookie'];

    // 2. Create Movie, Theatre, Screen, Show
    testMovie = await Movie.create({
      title: 'Inception',
      description: 'Dream sharing heist.',
      durationMinutes: 148,
      languages: ['English'],
      genres: ['Sci-Fi'],
      posterUrl: 'https://example.com/poster.jpg',
      releaseDate: new Date('2026-01-01'),
      isActive: true,
    });

    testTheatre = await Theatre.create({
      name: 'Cinepolis Downtown',
      city: 'Delhi',
      address: 'Saket, Delhi',
      timezone: 'Asia/Kolkata',
      isActive: true,
    });

    testScreen = await Screen.create({
      theatre: testTheatre._id,
      name: 'Screen 1',
      seatLayout: {
        rows: 2,
        columns: 5,
        aisleColumns: [3],
        gapSeats: ['A1'],
        rowCategories: { A: 'SILVER', B: 'GOLD' },
      },
      isActive: true,
    });

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(18, 0, 0, 0);

    testShow = await Show.create({
      movie: testMovie._id,
      screen: testScreen._id,
      startsAt: tomorrow,
      endsAt: new Date(tomorrow.getTime() + 163 * 60000),
      language: 'English',
      format: '2D',
      priceByCategory: { SILVER: 15000, GOLD: 25000 },
      currency: 'INR',
      status: 'SCHEDULED',
    });

    // 3. Create seats
    seatA2 = await ShowSeat.create({
      show: testShow._id,
      seatLabel: 'A2',
      row: 'A',
      number: 2,
      category: 'SILVER',
      priceInPaise: 15000,
      status: 'AVAILABLE',
    });

    seatA3 = await ShowSeat.create({
      show: testShow._id,
      seatLabel: 'A3',
      row: 'A',
      number: 3,
      category: 'SILVER',
      priceInPaise: 15000,
      status: 'AVAILABLE',
    });

    seatA4 = await ShowSeat.create({
      show: testShow._id,
      seatLabel: 'A4',
      row: 'A',
      number: 4,
      category: 'SILVER',
      priceInPaise: 15000,
      status: 'AVAILABLE',
    });
  });

  it('successfully acquires a hold on available seats with Idempotency-Key', async () => {
    const res = await request(app)
      .post('/api/v1/holds')
      .set('Cookie', userACookie)
      .set('Idempotency-Key', 'hold-key-101')
      .send({
        showId: testShow._id.toString(),
        seatIds: [seatA2._id.toString()],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.heldSeats.length).toBe(1);
    expect(res.body.data.heldSeats[0].seatLabel).toBe('A2');
    expect(res.body.data.totalAmountInPaise).toBe(15000);

    // Verify in DB
    const seatInDb = await ShowSeat.findById(seatA2._id);
    expect(seatInDb?.status).toBe('HELD');
    expect(seatInDb?.heldBy?.toString()).toBe(userA._id.toString());
    expect(new Date(seatInDb!.holdExpiresAt!).getTime()).toBeGreaterThan(Date.now());
  });

  it('RACE CONDITION: two users racing for the exact same seat simultaneously -> exactly ONE succeeds, the other gets 409', async () => {
    // Both User A and User B concurrently attempt to hold seat A2
    const [resA, resB] = await Promise.all([
      request(app)
        .post('/api/v1/holds')
        .set('Cookie', userACookie)
        .set('Idempotency-Key', 'race-key-A')
        .send({
          showId: testShow._id.toString(),
          seatIds: [seatA2._id.toString()],
        }),
      request(app)
        .post('/api/v1/holds')
        .set('Cookie', userBCookie)
        .set('Idempotency-Key', 'race-key-B')
        .send({
          showId: testShow._id.toString(),
          seatIds: [seatA2._id.toString()],
        }),
    ]);

    const statuses = [resA.status, resB.status];
    expect(statuses).toContain(201); // Exactly one succeeded
    expect(statuses).toContain(409); // Exactly one failed with 409 Conflict

    const failedRes = resA.status === 409 ? resA : resB;
    expect(failedRes.body.error.code).toBe('CONFLICT');
    expect(failedRes.body.error.details.conflictingSeats).toContain('A2');

    // Assert DB state: only ONE user holds the seat
    const seatInDb = await ShowSeat.findById(seatA2._id);
    expect(seatInDb?.status).toBe('HELD');
    const winnerId = resA.status === 201 ? userA._id.toString() : userB._id.toString();
    expect(seatInDb?.heldBy?.toString()).toBe(winnerId);
  });

  it('MULTI-SEAT ATOMICITY: all-or-nothing rollback when one seat in batch conflicts', async () => {
    // User A holds A2 first
    await request(app)
      .post('/api/v1/holds')
      .set('Cookie', userACookie)
      .set('Idempotency-Key', 'hold-key-a2')
      .send({
        showId: testShow._id.toString(),
        seatIds: [seatA2._id.toString()],
      });

    // User B attempts to hold [A2, A3] together
    const resB = await request(app)
      .post('/api/v1/holds')
      .set('Cookie', userBCookie)
      .set('Idempotency-Key', 'hold-key-b-multi')
      .send({
        showId: testShow._id.toString(),
        seatIds: [seatA2._id.toString(), seatA3._id.toString()],
      });

    expect(resB.status).toBe(409);
    expect(resB.body.error.code).toBe('CONFLICT');
    expect(resB.body.error.details.conflictingSeats).toContain('A2');

    // CRUCIAL ATOMICITY CHECK: Seat A3 must NOT be left held by User B
    const seatA3InDb = await ShowSeat.findById(seatA3._id);
    expect(seatA3InDb?.status).toBe('AVAILABLE');
    expect(seatA3InDb?.heldBy).toBeNull();
  });

  it('ANTI-HOARDING: blocks holding more than MAX_SEATS_PER_BOOKING (8 seats)', async () => {
    // Create 9 additional seats
    const extraSeats = [];
    for (let i = 1; i <= 9; i++) {
      extraSeats.push({
        show: testShow._id,
        seatLabel: `B${i}`,
        row: 'B',
        number: i,
        category: 'GOLD',
        priceInPaise: 25000,
        status: 'AVAILABLE',
      });
    }
    const createdExtra = await ShowSeat.insertMany(extraSeats);

    // Attempt to hold 9 seats in one request -> blocked by validation / service
    const res = await request(app)
      .post('/api/v1/holds')
      .set('Cookie', userACookie)
      .set('Idempotency-Key', 'hoard-attempt-1')
      .send({
        showId: testShow._id.toString(),
        seatIds: createdExtra.map((s) => s._id.toString()),
      });

    expect(res.status).toBe(422); // Validation caps max at 8
  });

  it('EXPIRED HOLD RE-CLAIM: an expired hold releases seat to be claimed by another user', async () => {
    // User A holds A4, but it expired in the past
    const expiredTimestamp = new Date(Date.now() - 5000);
    await ShowSeat.updateOne(
      { _id: seatA4._id },
      {
        $set: {
          status: 'HELD',
          heldBy: userA._id,
          holdExpiresAt: expiredTimestamp,
        },
      },
    );

    // User B attempts to hold A4 -> must succeed because hold is expired
    const resB = await request(app)
      .post('/api/v1/holds')
      .set('Cookie', userBCookie)
      .set('Idempotency-Key', 'claim-expired-hold')
      .send({
        showId: testShow._id.toString(),
        seatIds: [seatA4._id.toString()],
      });

    expect(resB.status).toBe(201);
    const updatedA4 = await ShowSeat.findById(seatA4._id);
    expect(updatedA4?.status).toBe('HELD');
    expect(updatedA4?.heldBy?.toString()).toBe(userB._id.toString());
  });

  it('EXPLICIT RELEASE: DELETE /api/v1/holds returns seats back to AVAILABLE', async () => {
    // User A holds A2
    await request(app)
      .post('/api/v1/holds')
      .set('Cookie', userACookie)
      .set('Idempotency-Key', 'hold-to-release')
      .send({
        showId: testShow._id.toString(),
        seatIds: [seatA2._id.toString()],
      });

    // User A releases A2
    const delRes = await request(app)
      .delete('/api/v1/holds')
      .set('Cookie', userACookie)
      .send({
        showId: testShow._id.toString(),
        seatIds: [seatA2._id.toString()],
      });

    expect(delRes.status).toBe(200);
    expect(delRes.body.data.releasedCount).toBe(1);

    const seatInDb = await ShowSeat.findById(seatA2._id);
    expect(seatInDb?.status).toBe('AVAILABLE');
    expect(seatInDb?.heldBy).toBeNull();
    expect(seatInDb?.holdExpiresAt).toBeNull();
  });

  it('BACKGROUND SWEEPER: HoldSweeper sweeps expired holds and writes an AuditLog', async () => {
    // Set seat A3 as expired
    await ShowSeat.updateOne(
      { _id: seatA3._id },
      {
        $set: {
          status: 'HELD',
          heldBy: userA._id,
          holdExpiresAt: new Date(Date.now() - 20000),
        },
      },
    );

    const sweptCount = await HoldSweeper.sweepExpiredHolds();
    expect(sweptCount).toBe(1);

    const seatInDb = await ShowSeat.findById(seatA3._id);
    expect(seatInDb?.status).toBe('AVAILABLE');
    expect(seatInDb?.heldBy).toBeNull();

    const audit = await AuditLog.findOne({ action: 'HOLD_EXPIRED' });
    expect(audit).not.toBeNull();
    expect(audit?.actorType).toBe('SYSTEM');
    expect(audit?.details.releasedCount).toBe(1);
  });
});

