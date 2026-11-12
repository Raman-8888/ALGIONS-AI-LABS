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
} from '../../../db/models/index.js';

describe('Booking Cancellation & Refund Engine (Phase 8)', () => {
  let userCookie: string[];
  let attackerCookie: string[];
  let user: any;
  let attacker: any;
  let testMovie: any;
  let testTheatre: any;
  let testScreen: any;

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
    ]);
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('Password123!', salt);

    user = await User.create({
      email: 'owner@example.com',
      passwordHash,
      name: 'Owner',
      role: 'CUSTOMER',
    });

    attacker = await User.create({
      email: 'attacker@example.com',
      passwordHash,
      name: 'Attacker',
      role: 'CUSTOMER',
    });

    const userLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'owner@example.com',
      password: 'Password123!',
    });
    userCookie = userLogin.headers['set-cookie'];

    const attackerLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'attacker@example.com',
      password: 'Password123!',
    });
    attackerCookie = attackerLogin.headers['set-cookie'];

    testMovie = await Movie.create({
      title: 'Gladiator II',
      description: 'Colosseum battles.',
      durationMinutes: 140,
      languages: ['English'],
      genres: ['Action'],
      posterUrl: 'https://example.com/gladiator.jpg',
      releaseDate: new Date('2026-01-01'),
      isActive: true,
    });

    testTheatre = await Theatre.create({
      name: 'PVR Plaza',
      city: 'Delhi',
      address: 'CP, Delhi',
      timezone: 'Asia/Kolkata',
      isActive: true,
    });

    testScreen = await Screen.create({
      theatre: testTheatre._id,
      name: 'Audi 1',
      seatLayout: {
        rows: 2,
        columns: 4,
        aisleColumns: [],
        gapSeats: [],
        rowCategories: { A: 'SILVER', B: 'GOLD' },
      },
      isActive: true,
    });
  });

  it('successfully cancels booking > 60m before showtime: releases seats, cancels tickets, sets REFUND_PENDING', async () => {
    // Show is scheduled 5 hours from now (> 60 mins cutoff)
    const futureShowTime = new Date(Date.now() + 5 * 3600 * 1000);
    const show = await Show.create({
      movie: testMovie._id,
      screen: testScreen._id,
      startsAt: futureShowTime,
      endsAt: new Date(futureShowTime.getTime() + 155 * 60000),
      language: 'English',
      format: '2D',
      priceByCategory: { SILVER: 20000, GOLD: 35000 },
      currency: 'INR',
      status: 'SCHEDULED',
    });

    const seat = await ShowSeat.create({
      show: show._id,
      seatLabel: 'A1',
      row: 'A',
      number: 1,
      category: 'SILVER',
      priceInPaise: 20000,
      status: 'BOOKED',
    });

    const booking = await Booking.create({
      reference: 'BK-CANCEL-OK',
      user: user._id,
      show: show._id,
      seats: [seat._id],
      seatSnapshots: [
        {
          seatId: seat._id as any,
          seatLabel: 'A1',
          category: 'SILVER',
          priceInPaise: 20000,
        },
      ],
      totalAmountInPaise: 20000,
      currency: 'INR',
      status: 'CONFIRMED',
      expiresAt: new Date(Date.now() + 600000),
    });

    await ShowSeat.updateOne({ _id: seat._id }, { $set: { booking: booking._id } });

    const payment = await Payment.create({
      booking: booking._id,
      amountInPaise: 20000,
      currency: 'INR',
      status: 'SUCCESS',
      refundStatus: 'NONE',
      transactionReference: 'TXN-OK-1',
      gatewayOutcome: 'MOCK_SUCCESS',
      paidAt: new Date(),
    });

    const ticket = await Ticket.create({
      reference: 'TKT-OK-1',
      booking: booking._id,
      showSeat: seat._id,
      show: show._id,
      qrToken: 'test.qr',
      status: 'VALID',
    });

    // Execute cancellation
    const cancelRes = await request(app)
      .post(`/api/v1/bookings/${booking._id}/cancel`)
      .set('Cookie', userCookie)
      .set('Idempotency-Key', 'cancel-key-01')
      .send({ reason: 'Change of plans' });

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.status).toBe('CANCELLED');
    expect(cancelRes.body.data.refund.refundStatus).toBe('REFUND_PENDING');
    expect(cancelRes.body.data.refund.refundAmountInPaise).toBe(20000);

    // Verify DB modifications
    const updatedBooking = await Booking.findById(booking._id);
    expect(updatedBooking?.status).toBe('CANCELLED');
    expect(updatedBooking?.cancellationReason).toBe('Change of plans');

    const updatedSeat = await ShowSeat.findById(seat._id);
    expect(updatedSeat?.status).toBe('AVAILABLE');
    expect(updatedSeat?.booking).toBeNull();

    const updatedTicket = await Ticket.findById(ticket._id);
    expect(updatedTicket?.status).toBe('CANCELLED');

    const updatedPayment = await Payment.findById(payment._id);
    expect(updatedPayment?.refundStatus).toBe('REFUND_PENDING');
  });

  it('rejects cancellation when cutoff window has closed (< 60m before showtime) with 422', async () => {
    // Show starts in 30 minutes (< 60m cutoff)
    const soonShowTime = new Date(Date.now() + 30 * 60 * 1000);
    const show = await Show.create({
      movie: testMovie._id,
      screen: testScreen._id,
      startsAt: soonShowTime,
      endsAt: new Date(soonShowTime.getTime() + 155 * 60000),
      language: 'English',
      format: '2D',
      priceByCategory: { SILVER: 20000, GOLD: 35000 },
      currency: 'INR',
      status: 'SCHEDULED',
    });

    const booking = await Booking.create({
      reference: 'BK-CANCEL-LATE',
      user: user._id,
      show: show._id,
      seats: [],
      seatSnapshots: [],
      totalAmountInPaise: 20000,
      currency: 'INR',
      status: 'CONFIRMED',
      expiresAt: new Date(Date.now() + 600000),
    });

    const res = await request(app)
      .post(`/api/v1/bookings/${booking._id}/cancel`)
      .set('Cookie', userCookie)
      .set('Idempotency-Key', 'cancel-late-key')
      .send({});

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    expect(res.body.error.message).toContain('Cancellation window has closed');
  });

  it('blocks non-owner attacker from cancelling another users booking with 403 Forbidden', async () => {
    const futureShowTime = new Date(Date.now() + 5 * 3600 * 1000);
    const show = await Show.create({
      movie: testMovie._id,
      screen: testScreen._id,
      startsAt: futureShowTime,
      endsAt: new Date(futureShowTime.getTime() + 155 * 60000),
      language: 'English',
      format: '2D',
      priceByCategory: { SILVER: 20000, GOLD: 35000 },
      currency: 'INR',
      status: 'SCHEDULED',
    });

    const booking = await Booking.create({
      reference: 'BK-NOT-YOURS',
      user: user._id, // Owned by user
      show: show._id,
      seats: [],
      seatSnapshots: [],
      totalAmountInPaise: 20000,
      currency: 'INR',
      status: 'CONFIRMED',
      expiresAt: new Date(Date.now() + 600000),
    });

    // Attacker attempts to cancel
    const res = await request(app)
      .post(`/api/v1/bookings/${booking._id}/cancel`)
      .set('Cookie', attackerCookie)
      .set('Idempotency-Key', 'attacker-key')
      .send({});

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

