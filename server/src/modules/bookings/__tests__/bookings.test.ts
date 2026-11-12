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
  Booking,
  Payment,
  Ticket,
  AuditLog,
  IdempotencyKey,
} from '../../../db/models/index.js';
import { verifyQrToken } from '../../../common/utils/index.js';

describe('Booking Confirmation, Payments & Tickets Engine (Phase 7)', () => {
  let userCookie: string[];
  let user: any;
  let testMovie: any;
  let testTheatre: any;
  let testScreen: any;
  let testShow: any;
  let seat1: any;
  let seat2: any;

  beforeAll(async () => {
    await setupTestDb();
    await Promise.all([
      User.init(),
      Movie.init(),
      Theatre.init(),
      Screen.init(),
      Show.init(),
      ShowSeat.init(),
      Booking.init(),
      Payment.init(),
      Ticket.init(),
      AuditLog.init(),
      IdempotencyKey.init(),
    ]);
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();

    // 1. Create User
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('Password123!', salt);
    user = await User.create({
      email: 'customer@example.com',
      passwordHash,
      name: 'Rohan Sharma',
      role: 'CUSTOMER',
    });

    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email: 'customer@example.com',
      password: 'Password123!',
    });
    userCookie = loginRes.headers['set-cookie'];

    // 2. Create Movie, Theatre, Screen, Show
    testMovie = await Movie.create({
      title: 'Oppenheimer',
      description: 'Historical drama.',
      durationMinutes: 180,
      languages: ['English'],
      genres: ['Drama'],
      posterUrl: 'https://example.com/oppenheimer.jpg',
      releaseDate: new Date('2026-01-01'),
      isActive: true,
    });

    testTheatre = await Theatre.create({
      name: 'PVR ICON',
      city: 'Mumbai',
      address: 'Andheri West, Mumbai',
      timezone: 'Asia/Kolkata',
      isActive: true,
    });

    testScreen = await Screen.create({
      theatre: testTheatre._id,
      name: 'IMAX Audi 1',
      seatLayout: {
        rows: 2,
        columns: 4,
        aisleColumns: [2],
        gapSeats: [],
        rowCategories: { A: 'SILVER', B: 'GOLD' },
      },
      isActive: true,
    });

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(19, 0, 0, 0);

    testShow = await Show.create({
      movie: testMovie._id,
      screen: testScreen._id,
      startsAt: tomorrow,
      endsAt: new Date(tomorrow.getTime() + 195 * 60000),
      language: 'English',
      format: 'IMAX',
      priceByCategory: { SILVER: 25000, GOLD: 45000 },
      currency: 'INR',
      status: 'SCHEDULED',
    });

    seat1 = await ShowSeat.create({
      show: testShow._id,
      seatLabel: 'A1',
      row: 'A',
      number: 1,
      category: 'SILVER',
      priceInPaise: 25000,
      status: 'AVAILABLE',
    });

    seat2 = await ShowSeat.create({
      show: testShow._id,
      seatLabel: 'A2',
      row: 'A',
      number: 2,
      category: 'SILVER',
      priceInPaise: 25000,
      status: 'AVAILABLE',
    });
  });

  it('checkout: successfully books held seats with MOCK_SUCCESS, creates Tickets and QR tokens', async () => {
    // 1. Hold seats first
    await request(app)
      .post('/api/v1/holds')
      .set('Cookie', userCookie)
      .set('Idempotency-Key', 'hold-checkout-1')
      .send({
        showId: testShow._id.toString(),
        seatIds: [seat1._id.toString(), seat2._id.toString()],
      });

    // 2. Perform checkout
    const checkoutRes = await request(app)
      .post('/api/v1/bookings/checkout')
      .set('Cookie', userCookie)
      .set('Idempotency-Key', 'checkout-key-101')
      .send({
        showId: testShow._id.toString(),
        seatIds: [seat1._id.toString(), seat2._id.toString()],
        gatewayOutcome: 'MOCK_SUCCESS',
      });

    expect(checkoutRes.status).toBe(201);
    const { booking, payment, tickets } = checkoutRes.body.data;

    expect(booking.status).toBe('CONFIRMED');
    expect(booking.totalAmountInPaise).toBe(50000); // 25000 * 2
    expect(payment.status).toBe('SUCCESS');
    expect(tickets.length).toBe(2);

    // Verify tickets have valid HMAC QR tokens
    for (const t of tickets) {
      expect(t.status).toBe('VALID');
      const decoded = verifyQrToken(t.qrToken);
      expect(decoded.bookingReference).toBe(booking.reference);
      expect(decoded.showId).toBe(testShow._id.toString());
    }

    // Verify seats transitioned to BOOKED and unset heldBy/holdExpiresAt
    const updatedSeat1 = await ShowSeat.findById(seat1._id);
    expect(updatedSeat1?.status).toBe('BOOKED');
    expect(updatedSeat1?.heldBy).toBeNull();
    expect(updatedSeat1?.holdExpiresAt).toBeNull();
    expect(updatedSeat1?.booking?.toString()).toBe(booking.id);
  });

  it('handles simulated gateway failure: Payment status is FAILED, booking stays PENDING_PAYMENT for retry', async () => {
    // 1. Hold seats
    await request(app)
      .post('/api/v1/holds')
      .set('Cookie', userCookie)
      .set('Idempotency-Key', 'hold-checkout-fail')
      .send({
        showId: testShow._id.toString(),
        seatIds: [seat1._id.toString()],
      });

    // 2. Attempt checkout with MOCK_FAIL
    const failRes = await request(app)
      .post('/api/v1/bookings/checkout')
      .set('Cookie', userCookie)
      .set('Idempotency-Key', 'checkout-key-fail')
      .send({
        showId: testShow._id.toString(),
        seatIds: [seat1._id.toString()],
        gatewayOutcome: 'MOCK_FAIL',
      });

    expect(failRes.status).toBe(400);
    expect(failRes.body.error.message).toContain('Payment declined');

    // Verify payment in DB
    const failedPayment = await Payment.findOne({ gatewayOutcome: 'MOCK_FAIL' });
    expect(failedPayment).not.toBeNull();
    expect(failedPayment?.status).toBe('FAILED');

    // Verify seat is still HELD by user (not lost immediately)
    const seatInDb = await ShowSeat.findById(seat1._id);
    expect(seatInDb?.status).toBe('HELD');
    expect(seatInDb?.heldBy?.toString()).toBe(user._id.toString());
  });

  it('FALLBACK RULE: Paid but hold expired during payment -> marks EXPIRED, sets REFUND_PENDING, returns 409', async () => {
    // 1. Hold seat
    await request(app)
      .post('/api/v1/holds')
      .set('Cookie', userCookie)
      .set('Idempotency-Key', 'hold-race-refund')
      .send({
        showId: testShow._id.toString(),
        seatIds: [seat1._id.toString()],
      });

    // 2. Initiate booking
    const initRes = await request(app)
      .post('/api/v1/bookings/initiate')
      .set('Cookie', userCookie)
      .send({
        showId: testShow._id.toString(),
        seatIds: [seat1._id.toString()],
      });
    expect(initRes.status).toBe(201);
    const bookingId = initRes.body.data.bookingId;

    // 3. Payment succeeds outside transaction
    const payRes = await request(app)
      .post('/api/v1/payments/simulate')
      .set('Cookie', userCookie)
      .set('Idempotency-Key', 'pay-key-refund-test')
      .send({
        bookingId,
        gatewayOutcome: 'MOCK_SUCCESS',
      });
    expect(payRes.status).toBe(200);
    const paymentId = payRes.body.data.payment._id;

    // 4. SIMULATE RACE CONDITION: hold lapses right before confirm is called!
    await ShowSeat.updateOne(
      { _id: seat1._id },
      { $set: { holdExpiresAt: new Date(Date.now() - 5000) } },
    );

    // 5. Customer calls confirm -> must trigger automatic refund fallback!
    const confirmRes = await request(app)
      .post(`/api/v1/bookings/${bookingId}/confirm`)
      .set('Cookie', userCookie)
      .set('Idempotency-Key', 'confirm-key-refund-test')
      .send({ paymentId });

    expect(confirmRes.status).toBe(409);
    expect(confirmRes.body.error.message).toContain('refund has been automatically initiated');

    // 6. Assert DB state
    const bookingInDb = await Booking.findById(bookingId);
    expect(bookingInDb?.status).toBe('EXPIRED');

    const paymentInDb = await Payment.findById(paymentId);
    expect(paymentInDb?.refundStatus).toBe('REFUND_PENDING');
    expect(paymentInDb?.refundAmountInPaise).toBe(25000);

    const audit = await AuditLog.findOne({ action: 'PAYMENT_CONFIRM_RACE_REFUND_TRIGGERED' });
    expect(audit).not.toBeNull();
  });

  it('IDEMPOTENCY: replaying checkout with identical key returns cached response without duplicate booking', async () => {
    // 1. Hold seat
    await request(app)
      .post('/api/v1/holds')
      .set('Cookie', userCookie)
      .set('Idempotency-Key', 'hold-idem-test')
      .send({
        showId: testShow._id.toString(),
        seatIds: [seat2._id.toString()],
      });

    const idempotencyKey = 'idem-checkout-test-999';
    const payload = {
      showId: testShow._id.toString(),
      seatIds: [seat2._id.toString()],
      gatewayOutcome: 'MOCK_SUCCESS',
    };

    // 1st request
    const firstRes = await request(app)
      .post('/api/v1/bookings/checkout')
      .set('Cookie', userCookie)
      .set('Idempotency-Key', idempotencyKey)
      .send(payload);

    expect(firstRes.status).toBe(201);
    expect(firstRes.headers['x-idempotent-replay']).toBeUndefined();

    // Small delay to allow async idempotency save
    await new Promise((r) => setTimeout(r, 60));

    // 2nd request with same key & payload
    const secondRes = await request(app)
      .post('/api/v1/bookings/checkout')
      .set('Cookie', userCookie)
      .set('Idempotency-Key', idempotencyKey)
      .send(payload);

    expect(secondRes.status).toBe(201);
    expect(secondRes.headers['x-idempotent-replay']).toBe('true');
    expect(secondRes.body.data.booking.reference).toBe(firstRes.body.data.booking.reference);

    // Assert only ONE booking was created in DB
    const totalBookings = await Booking.countDocuments({ user: user._id });
    expect(totalBookings).toBe(1);
  });

  it('GET /api/v1/bookings/my-bookings returns customer history with tickets', async () => {
    const res = await request(app)
      .get('/api/v1/bookings/my-bookings')
      .set('Cookie', userCookie);

    expect(res.status).toBe(200);
    expect(res.body.data.bookings).toBeDefined();
    expect(res.body.data.pagination).toBeDefined();
  });
});

