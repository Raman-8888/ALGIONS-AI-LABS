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
  Ticket,
} from '../../../db/models/index.js';
import { generateQrToken } from '../../../common/utils/index.js';

describe('Staff Single-Use Ticket Validation Engine (Phase 8)', () => {
  let staffCookie: string[];
  let customerCookie: string[];
  let staffUser: any;
  let customerUser: any;
  let testMovie: any;
  let testTheatre: any;
  let testScreen: any;
  let testShow: any;
  let testSeat: any;
  let testBooking: any;
  let testTicket: any;
  let validQrToken: string;

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

    // 1. Staff User
    staffUser = await User.create({
      email: 'staff@example.com',
      passwordHash,
      name: 'Auditorium Staff',
      role: 'STAFF',
    });

    // 2. Customer User
    customerUser = await User.create({
      email: 'patron@example.com',
      passwordHash,
      name: 'Patron',
      role: 'CUSTOMER',
    });

    const staffLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'staff@example.com',
      password: 'Password123!',
    });
    staffCookie = staffLogin.headers['set-cookie'];

    const custLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'patron@example.com',
      password: 'Password123!',
    });
    customerCookie = custLogin.headers['set-cookie'];

    // 3. Setup Movie, Theatre, Screen
    testMovie = await Movie.create({
      title: 'Interstellar',
      description: 'Space odyssey.',
      durationMinutes: 169,
      languages: ['English'],
      genres: ['Sci-Fi'],
      posterUrl: 'https://example.com/poster.jpg',
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

    // 4. Create Show starting in 10 minutes (within active entry window: startsAt - 30m to endsAt)
    const startsAt = new Date(Date.now() + 10 * 60 * 1000);
    const endsAt = new Date(startsAt.getTime() + 184 * 60000);

    testShow = await Show.create({
      movie: testMovie._id,
      screen: testScreen._id,
      startsAt,
      endsAt,
      language: 'English',
      format: '2D',
      priceByCategory: { SILVER: 20000, GOLD: 35000 },
      currency: 'INR',
      status: 'SCHEDULED',
    });

    testSeat = await ShowSeat.create({
      show: testShow._id,
      seatLabel: 'A1',
      row: 'A',
      number: 1,
      category: 'SILVER',
      priceInPaise: 20000,
      status: 'BOOKED',
    });

    testBooking = await Booking.create({
      reference: 'BK-VALIDATE-TEST',
      user: customerUser._id,
      show: testShow._id,
      seats: [testSeat._id],
      seatSnapshots: [
        {
          seatId: testSeat._id as any,
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

    validQrToken = generateQrToken({
      ticketId: testSeat._id.toString(),
      ticketReference: 'TKT-SCAN-01',
      bookingReference: testBooking.reference,
      showId: testShow._id.toString(),
    });

    testTicket = await Ticket.create({
      reference: 'TKT-SCAN-01',
      booking: testBooking._id,
      showSeat: testSeat._id,
      show: testShow._id,
      qrToken: validQrToken,
      status: 'VALID',
    });
  });

  it('validates a valid ticket via QR token: marks USED and stamps validator', async () => {
    const res = await request(app)
      .post('/api/v1/tickets/validate')
      .set('Cookie', staffCookie)
      .send({
        qrToken: validQrToken,
        activeShowId: testShow._id.toString(),
      });

    expect(res.status).toBe(200);
    expect(res.body.data.valid).toBe(true);
    expect(res.body.data.ticket.status).toBe('USED');
    expect(res.body.data.ticket.seatLabel).toBe('A1');
    expect(res.body.data.ticket.staffName).toBe('Auditorium Staff');

    const ticketInDb = await Ticket.findById(testTicket._id);
    expect(ticketInDb?.status).toBe('USED');
    expect(ticketInDb?.validatedBy?.toString()).toBe(staffUser._id.toString());
    expect(ticketInDb?.validatedAt).toBeDefined();
  });

  it('DOUBLE-SCAN PREVENTION: scanning the same ticket twice immediately fails on second scan with 409 Conflict', async () => {
    // 1st scan -> succeeds
    const firstScan = await request(app)
      .post('/api/v1/tickets/validate')
      .set('Cookie', staffCookie)
      .send({
        qrToken: validQrToken,
        activeShowId: testShow._id.toString(),
      });
    expect(firstScan.status).toBe(200);

    // 2nd scan -> rejected!
    const secondScan = await request(app)
      .post('/api/v1/tickets/validate')
      .set('Cookie', staffCookie)
      .send({
        qrToken: validQrToken,
        activeShowId: testShow._id.toString(),
      });

    expect(secondScan.status).toBe(409);
    expect(secondScan.body.error.code).toBe('CONFLICT');
    expect(secondScan.body.error.message).toContain('cannot be reused');
  });

  it('rejects ticket presentation when show does not match active auditorium show with 422', async () => {
    // Another show
    const anotherShow = await Show.create({
      movie: testMovie._id,
      screen: testScreen._id,
      startsAt: new Date(Date.now() + 10 * 60 * 1000),
      endsAt: new Date(Date.now() + 180 * 60 * 1000),
      language: 'English',
      format: '2D',
      priceByCategory: { SILVER: 20000, GOLD: 35000 },
      currency: 'INR',
      status: 'SCHEDULED',
    });

    const res = await request(app)
      .post('/api/v1/tickets/validate')
      .set('Cookie', staffCookie)
      .send({
        qrToken: validQrToken,
        activeShowId: anotherShow._id.toString(), // Wrong auditorium show!
      });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    expect(res.body.error.message).toContain('Show mismatch');
  });

  it('rejects ticket if parent booking was cancelled and refunded with 422', async () => {
    await Booking.updateOne({ _id: testBooking._id }, { $set: { status: 'CANCELLED' } });

    const res = await request(app)
      .post('/api/v1/tickets/validate')
      .set('Cookie', staffCookie)
      .send({
        ticketReference: testTicket.reference,
        activeShowId: testShow._id.toString(),
      });

    expect(res.status).toBe(422);
    expect(res.body.error.message).toContain('cancelled and refunded');
  });

  it('RBAC: blocks CUSTOMER from validating tickets with 403 Forbidden', async () => {
    const res = await request(app)
      .post('/api/v1/tickets/validate')
      .set('Cookie', customerCookie) // Customer attempt
      .send({
        ticketReference: testTicket.reference,
        activeShowId: testShow._id.toString(),
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

