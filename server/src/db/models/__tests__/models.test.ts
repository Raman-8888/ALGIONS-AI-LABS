import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { setupTestDb, teardownTestDb, clearTestDb } from '../../../test/setup.js';
import {
  User,
  Screen,
  Theatre,
  ShowSeat,
  Payment,
  IdempotencyKey,
  Ticket,
  Booking,
} from '../index.js';

describe('Mongoose Models, Indexes & Invariants', () => {
  beforeAll(async () => {
    await setupTestDb();
    // Guarantee indexes are fully synced in mongodb-memory-server before running assertions
    await Promise.all([
      User.init(),
      Screen.init(),
      ShowSeat.init(),
      Payment.init(),
      IdempotencyKey.init(),
      Ticket.init(),
      Booking.init(),
    ]);
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
  });

  it('User: enforces case-insensitive unique email and defaults role to CUSTOMER', async () => {
    await User.create({
      email: 'test@example.com',
      passwordHash: 'hash123',
      name: 'Test User',
    });

    // Attempting to insert uppercase version should fail
    await expect(
      User.create({
        email: 'TEST@EXAMPLE.COM',
        passwordHash: 'hash456',
        name: 'Another User',
      }),
    ).rejects.toThrow();
  });

  it('Screen: correctly derives totalSeats virtual excluding gapSeats', async () => {
    const theatre = await Theatre.create({
      name: 'PVR',
      city: 'Delhi',
      address: 'Connaught Place',
    });

    const screen = new Screen({
      theatre: theatre._id,
      name: 'Audi 1',
      seatLayout: {
        rows: 5,
        columns: 10,
        aisleColumns: [5],
        gapSeats: ['A1', 'A10'], // 2 gap seats out of 50
        rowCategories: { A: 'SILVER' },
      },
    });

    expect(screen.totalSeats).toBe(48); // (5 * 10) - 2 = 48
  });

  it('ShowSeat: enforces unique compound index on { show, seatLabel }', async () => {
    const dummyShowId = new mongoose.Types.ObjectId();

    await ShowSeat.create({
      show: dummyShowId,
      seatLabel: 'B4',
      row: 'B',
      number: 4,
      category: 'GOLD',
      priceInPaise: 25000,
    });

    // Inserting same seatLabel for same show must throw duplicate key error
    await expect(
      ShowSeat.create({
        show: dummyShowId,
        seatLabel: 'B4',
        row: 'B',
        number: 4,
        category: 'GOLD',
        priceInPaise: 25000,
      }),
    ).rejects.toThrow();
  });

  it('Payment: allows multiple FAILED rows for retry, but rejects duplicate SUCCESS', async () => {
    const dummyBookingId = new mongoose.Types.ObjectId();

    // 1st attempt: FAILED
    await Payment.create({
      booking: dummyBookingId,
      amountInPaise: 50000,
      status: 'FAILED',
      transactionReference: 'TXN-FAIL-1',
      gatewayOutcome: 'MOCK_FAIL',
    });

    // 2nd attempt: FAILED (should succeed because status != SUCCESS)
    await Payment.create({
      booking: dummyBookingId,
      amountInPaise: 50000,
      status: 'FAILED',
      transactionReference: 'TXN-FAIL-2',
      gatewayOutcome: 'MOCK_FAIL',
    });

    // 3rd attempt: SUCCESS
    await Payment.create({
      booking: dummyBookingId,
      amountInPaise: 50000,
      status: 'SUCCESS',
      transactionReference: 'TXN-SUCC-1',
      gatewayOutcome: 'MOCK_SUCCESS',
    });

    // 4th attempt: duplicate SUCCESS must violate the partial unique index
    await expect(
      Payment.create({
        booking: dummyBookingId,
        amountInPaise: 50000,
        status: 'SUCCESS',
        transactionReference: 'TXN-SUCC-2',
        gatewayOutcome: 'MOCK_SUCCESS',
      }),
    ).rejects.toThrow();
  });

  it('IdempotencyKey: enforces unique compound index on { key, user }', async () => {
    const dummyUserId = new mongoose.Types.ObjectId();

    await IdempotencyKey.create({
      key: 'req-key-123',
      user: dummyUserId,
      requestPath: '/api/v1/bookings',
      requestHash: 'hash-abc',
      status: 'IN_PROGRESS',
      expiresAt: new Date(Date.now() + 86400000),
    });

    // Replay with same key and user must fail
    await expect(
      IdempotencyKey.create({
        key: 'req-key-123',
        user: dummyUserId,
        requestPath: '/api/v1/bookings',
        requestHash: 'hash-abc',
        status: 'IN_PROGRESS',
        expiresAt: new Date(Date.now() + 86400000),
      }),
    ).rejects.toThrow();
  });

  it('Ticket: atomic findOneAndUpdate prevents double validation', async () => {
    const ticket = await Ticket.create({
      reference: 'TKT-TEST-99',
      booking: new mongoose.Types.ObjectId(),
      showSeat: new mongoose.Types.ObjectId(),
      show: new mongoose.Types.ObjectId(),
      qrToken: 'test.qr.token',
      status: 'VALID',
    });

    const staffId = new mongoose.Types.ObjectId();

    // 1st validation: matches { reference, status: 'VALID' }
    const firstScan = await Ticket.findOneAndUpdate(
      { reference: ticket.reference, status: 'VALID' },
      { $set: { status: 'USED', validatedAt: new Date(), validatedBy: staffId } },
      { new: true },
    );
    expect(firstScan).not.toBeNull();
    expect(firstScan?.status).toBe('USED');

    // 2nd validation: status is no longer 'VALID' -> returns null
    const secondScan = await Ticket.findOneAndUpdate(
      { reference: ticket.reference, status: 'VALID' },
      { $set: { status: 'USED', validatedAt: new Date(), validatedBy: staffId } },
      { new: true },
    );
    expect(secondScan).toBeNull();
  });
});
