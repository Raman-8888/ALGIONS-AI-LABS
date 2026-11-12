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
} from '../../../db/models/index.js';

describe('Discovery APIs & Live Seat Map Engine (Phase 5)', () => {
  let userACookie: string[];
  let userBCookie: string[];
  let userA: any;
  let userB: any;
  let testMovie: any;
  let testTheatre: any;
  let testScreen: any;
  let testShow: any;

  beforeAll(async () => {
    await setupTestDb();
    await Promise.all([
      User.init(),
      Movie.init(),
      Theatre.init(),
      Screen.init(),
      Show.init(),
      ShowSeat.init(),
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

    // 2. Create Movie
    testMovie = await Movie.create({
      title: 'Dune: Part Three',
      description: 'The desert saga continues.',
      durationMinutes: 150,
      languages: ['English', 'Hindi'],
      genres: ['Sci-Fi', 'Adventure'],
      posterUrl: 'https://example.com/dune.jpg',
      releaseDate: new Date('2026-10-01'),
      isActive: true,
    });

    // 3. Create Theatre & Screen
    testTheatre = await Theatre.create({
      name: 'PVR Phoenix Palladium',
      city: 'Mumbai',
      address: 'Lower Parel, Mumbai',
      timezone: 'Asia/Kolkata',
      isActive: true,
    });

    // 2 rows (A-B), 4 columns = 8 seats. 'A1' is gap -> 7 seats
    testScreen = await Screen.create({
      theatre: testTheatre._id,
      name: 'Screen 1 Gold Class',
      seatLayout: {
        rows: 2,
        columns: 4,
        aisleColumns: [2],
        gapSeats: ['A1'],
        rowCategories: {
          A: 'SILVER',
          B: 'GOLD',
        },
      },
      isActive: true,
    });

    // 4. Create Show
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(19, 0, 0, 0);

    testShow = await Show.create({
      movie: testMovie._id,
      screen: testScreen._id,
      startsAt: tomorrow,
      endsAt: new Date(tomorrow.getTime() + 165 * 60000), // 150m + 15m
      language: 'English',
      format: '2D',
      priceByCategory: {
        SILVER: 20000,
        GOLD: 35000,
      },
      currency: 'INR',
      status: 'SCHEDULED',
    });

    // 5. Generate ShowSeat documents
    const seats = [
      // Row A (A2, A3, A4 - A1 is gap)
      {
        show: testShow._id,
        seatLabel: 'A2',
        row: 'A',
        number: 2,
        category: 'SILVER',
        priceInPaise: 20000,
        status: 'AVAILABLE',
      },
      {
        show: testShow._id,
        seatLabel: 'A3',
        row: 'A',
        number: 3,
        category: 'SILVER',
        priceInPaise: 20000,
        status: 'AVAILABLE',
      },
      {
        show: testShow._id,
        seatLabel: 'A4',
        row: 'A',
        number: 4,
        category: 'SILVER',
        priceInPaise: 20000,
        status: 'AVAILABLE',
      },
      // Row B (B1, B2, B3, B4)
      {
        show: testShow._id,
        seatLabel: 'B1',
        row: 'B',
        number: 1,
        category: 'GOLD',
        priceInPaise: 35000,
        status: 'AVAILABLE',
      },
      {
        show: testShow._id,
        seatLabel: 'B2',
        row: 'B',
        number: 2,
        category: 'GOLD',
        priceInPaise: 35000,
        status: 'AVAILABLE',
      },
      {
        show: testShow._id,
        seatLabel: 'B3',
        row: 'B',
        number: 3,
        category: 'GOLD',
        priceInPaise: 35000,
        status: 'AVAILABLE',
      },
      {
        show: testShow._id,
        seatLabel: 'B4',
        row: 'B',
        number: 4,
        category: 'GOLD',
        priceInPaise: 35000,
        status: 'AVAILABLE',
      },
    ];

    await ShowSeat.insertMany(seats);
  });

  it('GET /api/v1/seats/show/:showId returns seat map with layout, summary, and prices', async () => {
    const res = await request(app).get(`/api/v1/seats/show/${testShow._id}`);

    expect(res.status).toBe(200);
    const { show, summary, seats } = res.body.data;

    expect(show.movie.title).toBe('Dune: Part Three');
    expect(show.screen.name).toBe('Screen 1 Gold Class');
    expect(show.screen.seatLayout.rows).toBe(2);

    expect(summary.totalSeats).toBe(7);
    expect(summary.availableSeats).toBe(7);
    expect(summary.heldSeats).toBe(0);
    expect(summary.bookedSeats).toBe(0);
    expect(summary.priceRange.min).toBe(20000);
    expect(summary.priceRange.max).toBe(35000);

    expect(seats.length).toBe(7);
    expect(seats[0].seatLabel).toBe('A2');
    expect(seats[0].status).toBe('AVAILABLE');
  });

  it('Dual Expiry: dynamically evaluates expired holds (holdExpiresAt < now) as AVAILABLE', async () => {
    // Manually simulate a seat with an expired hold
    const expiredTimestamp = new Date(Date.now() - 10000); // Expired 10 seconds ago
    await ShowSeat.updateOne(
      { show: testShow._id, seatLabel: 'B1' },
      {
        $set: {
          status: 'HELD',
          heldBy: userA._id,
          holdExpiresAt: expiredTimestamp,
        },
      },
    );

    const res = await request(app).get(`/api/v1/seats/show/${testShow._id}`);

    expect(res.status).toBe(200);
    const { summary, seats } = res.body.data;

    const seatB1 = seats.find((s: any) => s.seatLabel === 'B1');
    expect(seatB1).toBeDefined();
    // Must be lazily evaluated as AVAILABLE!
    expect(seatB1.status).toBe('AVAILABLE');
    expect(summary.availableSeats).toBe(7);
    expect(summary.heldSeats).toBe(0);
  });

  it('Active Hold: differentiates holder (isMine: true with countdown) from other users (isMine: false)', async () => {
    const futureTimestamp = new Date(Date.now() + 300000); // 5 minutes in future
    await ShowSeat.updateOne(
      { show: testShow._id, seatLabel: 'B2' },
      {
        $set: {
          status: 'HELD',
          heldBy: userA._id,
          holdExpiresAt: futureTimestamp,
        },
      },
    );

    // 1. Query by User A (the holder)
    const resA = await request(app)
      .get(`/api/v1/seats/show/${testShow._id}`)
      .set('Cookie', userACookie);

    expect(resA.status).toBe(200);
    const seatB2ForA = resA.body.data.seats.find((s: any) => s.seatLabel === 'B2');
    expect(seatB2ForA.status).toBe('HELD');
    expect(seatB2ForA.isMine).toBe(true);
    expect(seatB2ForA.holdSecondsRemaining).toBeGreaterThan(250);

    // 2. Query by User B (another user)
    const resB = await request(app)
      .get(`/api/v1/seats/show/${testShow._id}`)
      .set('Cookie', userBCookie);

    expect(resB.status).toBe(200);
    const seatB2ForB = resB.body.data.seats.find((s: any) => s.seatLabel === 'B2');
    expect(seatB2ForB.status).toBe('HELD');
    expect(seatB2ForB.isMine).toBe(false);
    expect(seatB2ForB.holdSecondsRemaining).toBeUndefined();

    // 3. Summary check
    expect(resA.body.data.summary.heldSeats).toBe(1);
    expect(resA.body.data.summary.availableSeats).toBe(6);
  });

  it('GET /api/v1/shows/movie/:movieId returns upcoming showtimes grouped by theatre', async () => {
    const res = await request(app).get(`/api/v1/shows/movie/${testMovie._id}`);

    expect(res.status).toBe(200);
    const theatres = res.body.data.theatres;
    expect(theatres.length).toBe(1);
    expect(theatres[0].theatre.name).toBe('PVR Phoenix Palladium');
    expect(theatres[0].shows.length).toBe(1);
    expect(theatres[0].shows[0].format).toBe('2D');
  });
});
