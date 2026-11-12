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
  AuditLog,
} from '../../../db/models/index.js';

describe('Reports & Audit Trail Engine (Phase 9)', () => {
  let adminCookie: string[];
  let customerCookie: string[];
  let adminUser: any;
  let customerUser: any;
  let testMovie: any;
  let testTheatre: any;
  let testScreen: any;
  let testShow: any;
  let seats: any[];

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
      AuditLog.init(),
    ]);
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('Password123!', salt);

    adminUser = await User.create({
      email: 'admin@algions.com',
      passwordHash,
      name: 'Admin',
      role: 'ADMIN',
    });

    customerUser = await User.create({
      email: 'customer@algions.com',
      passwordHash,
      name: 'Customer',
      role: 'CUSTOMER',
    });

    const adminLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'admin@algions.com',
      password: 'Password123!',
    });
    adminCookie = adminLogin.headers['set-cookie'];

    const custLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'customer@algions.com',
      password: 'Password123!',
    });
    customerCookie = custLogin.headers['set-cookie'];

    testMovie = await Movie.create({
      title: 'Dune: Part Two',
      description: 'Desert epic.',
      durationMinutes: 166,
      languages: ['English'],
      genres: ['Sci-Fi'],
      posterUrl: 'https://example.com/poster.jpg',
      releaseDate: new Date('2026-01-01'),
      isActive: true,
    });

    testTheatre = await Theatre.create({
      name: 'PVR Galleria',
      city: 'Bengaluru',
      address: 'Whitefield, Bengaluru',
      timezone: 'Asia/Kolkata',
      isActive: true,
    });

    testScreen = await Screen.create({
      theatre: testTheatre._id,
      name: 'Screen 1',
      seatLayout: {
        rows: 2,
        columns: 5, // 10 total seats
        aisleColumns: [],
        gapSeats: [],
        rowCategories: { A: 'SILVER', B: 'GOLD' },
      },
      isActive: true,
    });

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(20, 0, 0, 0);

    testShow = await Show.create({
      movie: testMovie._id,
      screen: testScreen._id,
      startsAt: tomorrow,
      endsAt: new Date(tomorrow.getTime() + 181 * 60000),
      language: 'English',
      format: '2D',
      priceByCategory: { SILVER: 20000, GOLD: 30000 },
      currency: 'INR',
      status: 'SCHEDULED',
    });

    // Create 10 seats (A1-A5, B1-B5)
    seats = [];
    for (let c = 1; c <= 5; c++) {
      seats.push(
        await ShowSeat.create({
          show: testShow._id,
          seatLabel: `A${c}`,
          row: 'A',
          number: c,
          category: 'SILVER',
          priceInPaise: 20000,
          status: 'AVAILABLE',
        }),
      );
    }
    for (let c = 1; c <= 5; c++) {
      seats.push(
        await ShowSeat.create({
          show: testShow._id,
          seatLabel: `B${c}`,
          row: 'B',
          number: c,
          category: 'GOLD',
          priceInPaise: 30000,
          status: 'AVAILABLE',
        }),
      );
    }
  });

  it('ACCEPTANCE TEST 5: Occupancy report strictly equals confirmed bookings minus cancellations', async () => {
    // 1. Initial State: 10 seats, 0 booked -> 0% occupancy
    const initialReport = await request(app)
      .get('/api/v1/reports/occupancy')
      .set('Cookie', adminCookie);

    expect(initialReport.status).toBe(200);
    expect(initialReport.body.data.summary.totalCapacity).toBe(10);
    expect(initialReport.body.data.summary.totalBooked).toBe(0);
    expect(initialReport.body.data.summary.overallOccupancyPercentage).toBe(0);

    // 2. Customer books 3 seats (A1, A2, A3) in two separate bookings
    // Booking 1: A1, A2 (2 seats = 40000 paise)
    const booking1 = await Booking.create({
      reference: 'BK-OCC-1',
      user: customerUser._id,
      show: testShow._id,
      seats: [seats[0]._id, seats[1]._id],
      seatSnapshots: [
        { seatId: seats[0]._id, seatLabel: 'A1', category: 'SILVER', priceInPaise: 20000 },
        { seatId: seats[1]._id, seatLabel: 'A2', category: 'SILVER', priceInPaise: 20000 },
      ],
      totalAmountInPaise: 40000,
      currency: 'INR',
      status: 'CONFIRMED',
      expiresAt: new Date(Date.now() + 600000),
    });

    await ShowSeat.updateMany(
      { _id: { $in: [seats[0]._id, seats[1]._id] } },
      { $set: { status: 'BOOKED', booking: booking1._id } },
    );

    // Booking 2: A3 (1 seat = 20000 paise)
    const booking2 = await Booking.create({
      reference: 'BK-OCC-2',
      user: customerUser._id,
      show: testShow._id,
      seats: [seats[2]._id],
      seatSnapshots: [
        { seatId: seats[2]._id, seatLabel: 'A3', category: 'SILVER', priceInPaise: 20000 },
      ],
      totalAmountInPaise: 20000,
      currency: 'INR',
      status: 'CONFIRMED',
      expiresAt: new Date(Date.now() + 600000),
    });

    await ShowSeat.updateMany(
      { _id: seats[2]._id },
      { $set: { status: 'BOOKED', booking: booking2._id } },
    );

    // 3. Occupancy check after 3 seats booked: 3 / 10 = 30.0%
    const bookedReport = await request(app)
      .get('/api/v1/reports/occupancy')
      .set('Cookie', adminCookie);

    expect(bookedReport.body.data.summary.totalBooked).toBe(3);
    expect(bookedReport.body.data.summary.overallOccupancyPercentage).toBe(30);
    expect(bookedReport.body.data.shows[0].bookedSeats).toBe(3);

    // 4. NOW CANCEL BOOKING 2 (A3): 1 seat cancelled!
    await request(app)
      .post(`/api/v1/bookings/${booking2._id}/cancel`)
      .set('Cookie', customerCookie)
      .set('Idempotency-Key', 'cancel-occ-test')
      .send({ reason: 'Accidental booking' });

    // 5. Occupancy check: MUST EQUAL confirmed bookings minus cancellations: 3 - 1 = 2 seats! (20.0%)
    const afterCancelReport = await request(app)
      .get('/api/v1/reports/occupancy')
      .set('Cookie', adminCookie);

    expect(afterCancelReport.body.data.summary.totalBooked).toBe(2); // Exactly 2!
    expect(afterCancelReport.body.data.summary.overallOccupancyPercentage).toBe(20);
    expect(afterCancelReport.body.data.shows[0].bookedSeats).toBe(2);
    expect(afterCancelReport.body.data.shows[0].availableSeats).toBe(8);
  });

  it('aggregates sales report: gross revenue, refunds, and net revenue', async () => {
    // 1 confirmed booking of 40,000 paise
    await Booking.create({
      reference: 'BK-SALES-1',
      user: customerUser._id,
      show: testShow._id,
      seats: [seats[0]._id, seats[1]._id],
      seatSnapshots: [],
      totalAmountInPaise: 40000,
      currency: 'INR',
      status: 'CONFIRMED',
      expiresAt: new Date(Date.now() + 600000),
    });

    // 1 refunded payment of 15,000 paise
    await Payment.create({
      booking: seats[0]._id,
      amountInPaise: 15000,
      currency: 'INR',
      status: 'SUCCESS',
      refundStatus: 'REFUNDED',
      refundAmountInPaise: 15000,
      transactionReference: 'TXN-REFUND-1',
      gatewayOutcome: 'MOCK_SUCCESS',
      paidAt: new Date(),
    });

    const res = await request(app)
      .get('/api/v1/reports/sales')
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    const fin = res.body.data.financials;

    expect(fin.grossRevenueInPaise).toBe(40000);
    expect(fin.grossRevenueRupees).toBe(400);
    expect(fin.refundedRevenueInPaise).toBe(15000);
    expect(fin.refundedRevenueRupees).toBe(150);
    expect(fin.netRevenueInPaise).toBe(25000);
    expect(fin.netRevenueRupees).toBe(250);
  });

  it('GET /api/v1/audit returns append-only audit trail and supports filtering', async () => {
    await AuditLog.create({
      actorType: 'USER',
      actorId: adminUser._id,
      action: 'SHOW_CREATE',
      entity: 'Show',
      entityId: testShow._id.toString(),
      details: { format: '2D' },
      requestId: 'test-req-1',
    });

    await AuditLog.create({
      actorType: 'USER',
      actorId: customerUser._id,
      action: 'BOOKING_CONFIRM',
      entity: 'Booking',
      entityId: 'bk_123',
      details: { seats: ['A1'] },
      requestId: 'test-req-2',
    });

    // 1. Fetch all
    const allRes = await request(app)
      .get('/api/v1/audit')
      .set('Cookie', adminCookie);

    expect(allRes.status).toBe(200);
    expect(allRes.body.data.logs.length).toBeGreaterThanOrEqual(2);

    // 2. Filter by action
    const filterRes = await request(app)
      .get('/api/v1/audit?action=SHOW_CREATE')
      .set('Cookie', adminCookie);

    expect(filterRes.status).toBe(200);
    expect(filterRes.body.data.logs.every((l: any) => l.action === 'SHOW_CREATE')).toBe(true);
  });

  it('RBAC: non-admin customers are blocked with 403 Forbidden', async () => {
    const occRes = await request(app)
      .get('/api/v1/reports/occupancy')
      .set('Cookie', customerCookie);
    expect(occRes.status).toBe(403);

    const salesRes = await request(app)
      .get('/api/v1/reports/sales')
      .set('Cookie', customerCookie);
    expect(salesRes.status).toBe(403);

    const auditRes = await request(app)
      .get('/api/v1/audit')
      .set('Cookie', customerCookie);
    expect(auditRes.status).toBe(403);
  });
});

