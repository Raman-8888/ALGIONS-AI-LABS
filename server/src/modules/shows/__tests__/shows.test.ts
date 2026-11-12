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

describe('Cinema Config & Show Scheduling Engine (Phase 4)', () => {
  let adminCookie: string[];
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

    // 1. Create Admin & login
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('Password123!', salt);
    await User.create({
      email: 'admin@algions.com',
      passwordHash,
      name: 'Admin User',
      role: 'ADMIN',
      isActive: true,
    });

    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email: 'admin@algions.com',
      password: 'Password123!',
    });
    adminCookie = loginRes.headers['set-cookie'];

    // 2. Create Movie
    testMovie = await Movie.create({
      title: 'Avatar Re-Release',
      description: 'Sci-Fi adventure in Pandora.',
      durationMinutes: 120, // 2 hours
      languages: ['English', 'Hindi'],
      genres: ['Sci-Fi', 'Action'],
      posterUrl: 'https://example.com/avatar.jpg',
      releaseDate: new Date('2026-01-01'),
      isActive: true,
    });

    // 3. Create Theatre
    testTheatre = await Theatre.create({
      name: 'Algions Cineplex Downtown',
      city: 'Mumbai',
      address: 'Marine Drive, Mumbai',
      timezone: 'Asia/Kolkata',
      isActive: true,
    });

    // 4. Create Screen (3 rows A-C, 4 cols = 12 seats, A1 is gap -> 11 seats)
    testScreen = await Screen.create({
      theatre: testTheatre._id,
      name: 'Audi 1',
      seatLayout: {
        rows: 3,
        columns: 4,
        aisleColumns: [2],
        gapSeats: ['A1'],
        rowCategories: {
          A: 'SILVER',
          B: 'GOLD',
          C: 'PLATINUM',
        },
      },
      isActive: true,
    });
  });

  it('creates a show, calculates endsAt with 15m cleaning buffer, and generates all ShowSeat documents', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(18, 0, 0, 0); // 6:00 PM

    const res = await request(app)
      .post('/api/v1/shows')
      .set('Cookie', adminCookie)
      .send({
        movieId: testMovie._id.toString(),
        screenId: testScreen._id.toString(),
        startsAt: tomorrow.toISOString(),
        language: 'Hindi',
        format: '2D',
        priceByCategory: {
          SILVER: 15000,
          GOLD: 25000,
          PLATINUM: 40000,
        },
      });

    expect(res.status).toBe(201);
    const createdShow = res.body.data.show;
    expect(createdShow).toBeDefined();

    // Verify endsAt: 120 mins duration + 15 mins buffer = 135 mins = 2h 15m -> 8:15 PM
    const startsAtMs = new Date(createdShow.startsAt).getTime();
    const endsAtMs = new Date(createdShow.endsAt).getTime();
    expect(endsAtMs - startsAtMs).toBe((120 + 15) * 60000);

    // Verify ShowSeats generated
    const seats = await ShowSeat.find({ show: createdShow._id });
    expect(seats.length).toBe(11); // 12 total minus 1 gap (A1)

    // Check gapSeat A1 was not created
    const gapSeat = seats.find((s) => s.seatLabel === 'A1');
    expect(gapSeat).toBeUndefined();

    // Check row C price is PLATINUM (40000)
    const seatC1 = seats.find((s) => s.seatLabel === 'C1');
    expect(seatC1?.category).toBe('PLATINUM');
    expect(seatC1?.priceInPaise).toBe(40000);
    expect(seatC1?.status).toBe('AVAILABLE');
  });

  it('rejects overlapping shows on the same screen with 409 Conflict', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(14, 0, 0, 0); // 2:00 PM

    // 1. Create first show: 2:00 PM to 4:15 PM (120m + 15m buffer)
    await request(app)
      .post('/api/v1/shows')
      .set('Cookie', adminCookie)
      .send({
        movieId: testMovie._id.toString(),
        screenId: testScreen._id.toString(),
        startsAt: tomorrow.toISOString(),
        language: 'English',
        format: '2D',
        priceByCategory: { SILVER: 15000, GOLD: 25000, PLATINUM: 40000 },
      });

    // 2. Attempt to schedule overlapping show starting at 3:30 PM (before 4:15 PM)
    const overlappingStart = new Date(tomorrow);
    overlappingStart.setHours(15, 30, 0, 0);

    const overlapRes = await request(app)
      .post('/api/v1/shows')
      .set('Cookie', adminCookie)
      .send({
        movieId: testMovie._id.toString(),
        screenId: testScreen._id.toString(),
        startsAt: overlappingStart.toISOString(),
        language: 'Hindi',
        format: '2D',
        priceByCategory: { SILVER: 15000, GOLD: 25000, PLATINUM: 40000 },
      });

    expect(overlapRes.status).toBe(409);
    expect(overlapRes.body.error.code).toBe('CONFLICT');
    expect(overlapRes.body.error.message).toContain('conflict');
  });

  it('rejects show creation if priceByCategory misses a category with 422 Unprocessable', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);

    const res = await request(app)
      .post('/api/v1/shows')
      .set('Cookie', adminCookie)
      .send({
        movieId: testMovie._id.toString(),
        screenId: testScreen._id.toString(),
        startsAt: tomorrow.toISOString(),
        language: 'Hindi',
        format: '2D',
        priceByCategory: {
          SILVER: 15000,
          GOLD: 25000,
          // PLATINUM missing!
        },
      });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    expect(res.body.error.message).toContain('PLATINUM');
  });

  it('soft-delete guards block deleting a movie or screen when scheduled shows exist', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(16, 0, 0, 0);

    // Schedule a show
    await request(app)
      .post('/api/v1/shows')
      .set('Cookie', adminCookie)
      .send({
        movieId: testMovie._id.toString(),
        screenId: testScreen._id.toString(),
        startsAt: tomorrow.toISOString(),
        language: 'Hindi',
        format: '2D',
        priceByCategory: { SILVER: 15000, GOLD: 25000, PLATINUM: 40000 },
      });

    // Attempt to delete movie
    const movieDelRes = await request(app)
      .delete(`/api/v1/movies/${testMovie._id}`)
      .set('Cookie', adminCookie);

    expect(movieDelRes.status).toBe(409);

    // Attempt to delete screen
    const screenDelRes = await request(app)
      .delete(`/api/v1/screens/${testScreen._id}`)
      .set('Cookie', adminCookie);

    expect(screenDelRes.status).toBe(409);
  });

  it('admin show cancellation cascades: cancels show, bookings, tickets, and triggers refund', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(20, 0, 0, 0);

    // 1. Create show
    const showRes = await request(app)
      .post('/api/v1/shows')
      .set('Cookie', adminCookie)
      .send({
        movieId: testMovie._id.toString(),
        screenId: testScreen._id.toString(),
        startsAt: tomorrow.toISOString(),
        language: 'Hindi',
        format: '2D',
        priceByCategory: { SILVER: 15000, GOLD: 25000, PLATINUM: 40000 },
      });

    const showId = showRes.body.data.show._id;

    // 2. Simulate a customer having booked a seat on this show
    const seat = await ShowSeat.findOne({ show: showId });
    expect(seat).not.toBeNull();

    const customerUser = await User.create({
      email: 'buyer@example.com',
      passwordHash: 'dummy',
      name: 'Buyer',
      role: 'CUSTOMER',
    });

    const booking = await Booking.create({
      reference: 'BK-CANCEL-TEST',
      user: customerUser._id,
      show: showId,
      seats: [seat!._id],
      seatSnapshots: [
        {
          seatId: seat!._id as any,
          seatLabel: seat!.seatLabel,
          category: seat!.category,
          priceInPaise: seat!.priceInPaise,
        },
      ],
      totalAmountInPaise: seat!.priceInPaise,
      currency: 'INR',
      status: 'CONFIRMED',
      expiresAt: new Date(Date.now() + 600000),
    });

    await ShowSeat.updateOne(
      { _id: seat!._id },
      { $set: { status: 'BOOKED', booking: booking._id } },
    );

    const payment = await Payment.create({
      booking: booking._id,
      amountInPaise: seat!.priceInPaise,
      currency: 'INR',
      status: 'SUCCESS',
      refundStatus: 'NONE',
      transactionReference: 'TXN-CANCEL-TEST',
      gatewayOutcome: 'MOCK_SUCCESS',
      paidAt: new Date(),
    });

    const ticket = await Ticket.create({
      reference: 'TKT-CANCEL-TEST',
      booking: booking._id,
      showSeat: seat!._id,
      show: showId,
      qrToken: 'dummy.qr.token',
      status: 'VALID',
    });

    // 3. Admin cancels show
    const cancelRes = await request(app)
      .post(`/api/v1/shows/${showId}/cancel`)
      .set('Cookie', adminCookie);

    expect(cancelRes.status).toBe(200);

    // 4. Verify cascade effects
    const updatedShow = await Show.findById(showId);
    expect(updatedShow?.status).toBe('CANCELLED');

    const updatedSeat = await ShowSeat.findById(seat!._id);
    expect(updatedSeat?.status).toBe('AVAILABLE');
    expect(updatedSeat?.booking).toBeNull();

    const updatedBooking = await Booking.findById(booking._id);
    expect(updatedBooking?.status).toBe('CANCELLED');
    expect(updatedBooking?.cancellationReason).toBe('SHOW_CANCELLED_BY_ADMIN');

    const updatedTicket = await Ticket.findById(ticket._id);
    expect(updatedTicket?.status).toBe('CANCELLED');

    const updatedPayment = await Payment.findById(payment._id);
    expect(updatedPayment?.refundStatus).toBe('REFUND_PENDING');
    expect(updatedPayment?.refundAmountInPaise).toBe(booking.totalAmountInPaise);
  });
});

