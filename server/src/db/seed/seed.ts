import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { config } from '../../common/config/index.js';
import {
  User,
  Genre,
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
} from '../models/index.js';
import { generateReference, generateQrToken } from '../../common/utils/index.js';

export async function runSeed(dropExisting = true) {
  console.log('[Seed] Starting database seed process...');
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(config.mongoUri);
    console.log(`[Seed] Connected to MongoDB: ${mongoose.connection.name}`);
  }

  if (dropExisting) {
    console.log('[Seed] Clearing existing collections...');
    await Promise.all([
      User.deleteMany({}),
      Genre.deleteMany({}),
      Movie.deleteMany({}),
      Theatre.deleteMany({}),
      Screen.deleteMany({}),
      Show.deleteMany({}),
      ShowSeat.deleteMany({}),
      Booking.deleteMany({}),
      Payment.deleteMany({}),
      Ticket.deleteMany({}),
      AuditLog.deleteMany({}),
      IdempotencyKey.deleteMany({}),
    ]);
  }

  // 1. Seed Users
  console.log('[Seed] Creating demo users...');
  const salt = await bcrypt.genSalt(10);
  const passwordHash1 = await bcrypt.hash('Password123!', salt);
  const passwordHash2 = await bcrypt.hash('Password@123', salt);

  const users = await User.create([
    {
      email: 'admin@algions.com',
      passwordHash: passwordHash1,
      name: 'System Admin',
      role: 'ADMIN',
      isActive: true,
    },
    {
      email: 'staff@algions.com',
      passwordHash: passwordHash1,
      name: 'Staff Scanner',
      role: 'STAFF',
      isActive: true,
    },
    {
      email: 'customer1@algions.com',
      passwordHash: passwordHash1,
      name: 'Rohan Sharma',
      role: 'CUSTOMER',
      isActive: true,
    },
    {
      email: 'customer2@algions.com',
      passwordHash: passwordHash1,
      name: 'Priya Patel',
      role: 'CUSTOMER',
      isActive: true,
    },
    {
      email: 'admin@cinema.com',
      passwordHash: passwordHash2,
      name: 'Cinema Admin',
      role: 'ADMIN',
      isActive: true,
    },
    {
      email: 'staff@cinema.com',
      passwordHash: passwordHash2,
      name: 'Cinema Staff',
      role: 'STAFF',
      isActive: true,
    },
    {
      email: 'customer@cinema.com',
      passwordHash: passwordHash2,
      name: 'Cinema Customer',
      role: 'CUSTOMER',
      isActive: true,
    },
  ]);
  const [adminUser, staffUser, customer1] = users;

  // 2. Seed Genres
  console.log('[Seed] Creating genres...');
  const genres = await Genre.create([
    { name: 'Sci-Fi', slug: 'sci-fi' },
    { name: 'Action', slug: 'action' },
    { name: 'Drama', slug: 'drama' },
    { name: 'Thriller', slug: 'thriller' },
  ]);

  // 3. Seed Theatres & Screens
  console.log('[Seed] Creating theatres & screens...');
  const theatre1 = await Theatre.create({
    name: 'Algions Cineplex Downtown',
    city: 'Mumbai',
    address: '101 Marine Drive, Nariman Point, Mumbai',
    timezone: 'Asia/Kolkata',
    isActive: true,
  });

  const theatre2 = await Theatre.create({
    name: 'Algions IMAX Galleria',
    city: 'Bengaluru',
    address: '42 Brigade Road, Bengaluru',
    timezone: 'Asia/Kolkata',
    isActive: true,
  });

  // Screen 1: 5 rows (A-E), 10 cols -> 50 seats
  const screen1 = await Screen.create({
    theatre: theatre1._id,
    name: 'Audi 1 (Dolby Atmos)',
    seatLayout: {
      rows: 5,
      columns: 10,
      aisleColumns: [5],
      gapSeats: [],
      rowCategories: {
        A: 'SILVER',
        B: 'SILVER',
        C: 'GOLD',
        D: 'GOLD',
        E: 'PLATINUM',
      },
    },
    isActive: true,
  });

  // Screen 2: 4 rows (A-D), 8 cols, with gap seats -> 30 seats
  const screen2 = await Screen.create({
    theatre: theatre1._id,
    name: 'Audi 2',
    seatLayout: {
      rows: 4,
      columns: 8,
      aisleColumns: [4],
      gapSeats: ['A1', 'A8'],
      rowCategories: {
        A: 'SILVER',
        B: 'SILVER',
        C: 'GOLD',
        D: 'PLATINUM',
      },
    },
    isActive: true,
  });

  // Screen 3: IMAX Screen
  const screen3 = await Screen.create({
    theatre: theatre2._id,
    name: 'IMAX Laser Hall',
    seatLayout: {
      rows: 6,
      columns: 10,
      aisleColumns: [5],
      gapSeats: [],
      rowCategories: {
        A: 'SILVER',
        B: 'SILVER',
        C: 'GOLD',
        D: 'GOLD',
        E: 'PLATINUM',
        F: 'PLATINUM',
      },
    },
    isActive: true,
  });

  // 4. Seed Movies
  console.log('[Seed] Creating movies...');
  const movies = await Movie.create([
    {
      title: 'Inception 2026',
      description:
        'A thief who steals corporate secrets through the use of dream-sharing technology is given the inverse task of planting an idea into the mind of a C.E.O.',
      durationMinutes: 148,
      languages: ['Hindi', 'English'],
      genres: ['Sci-Fi', 'Action'],
      posterUrl:
        'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=800&auto=format&fit=crop&q=80',
      trailerUrl: 'https://www.youtube.com/watch?v=YoHD9XEInc0',
      releaseDate: new Date('2026-01-15'),
      isActive: true,
    },
    {
      title: 'Interstellar Horizon',
      description:
        'When Earth becomes uninhabitable in the future, a farmer and ex-NASA pilot is tasked with piloting a spacecraft along with a team of researchers.',
      durationMinutes: 169,
      languages: ['English', 'Hindi'],
      genres: ['Sci-Fi', 'Drama'],
      posterUrl:
        'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop&q=80',
      trailerUrl: 'https://www.youtube.com/watch?v=zSWdZVtXT7E',
      releaseDate: new Date('2026-02-10'),
      isActive: true,
    },
    {
      title: 'Midnight Heist',
      description:
        'A master detective and a seasoned crew enter a high-stakes cat-and-mouse game in the neon-lit heart of Mumbai.',
      durationMinutes: 125,
      languages: ['Hindi'],
      genres: ['Action', 'Thriller'],
      posterUrl:
        'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=800&auto=format&fit=crop&q=80',
      trailerUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      releaseDate: new Date('2026-03-01'),
      isActive: true,
    },
  ]);

  // 5. Seed Shows & Generate ShowSeats
  console.log('[Seed] Creating shows and generating ShowSeat documents...');
  const now = new Date();
  const cleaningBufferMinutes = 15;

  const defaultPriceByCat = {
    SILVER: 15000, // ₹150 in paise
    GOLD: 25000, // ₹250 in paise
    PLATINUM: 40000, // ₹400 in paise
  };

  const showDocs = [];
  const screensList = [screen1, screen2, screen3];

  // Generate shows over the next 7 days
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    for (let screenIndex = 0; screenIndex < screensList.length; screenIndex++) {
      const scr = screensList[screenIndex];
      const selectedMovie = movies[(dayOffset + screenIndex) % movies.length];

      // Schedule 2 shows per screen per day (2:00 PM and 6:30 PM)
      const slotTimes = [
        { hour: 14, minute: 0 },
        { hour: 18, minute: 30 },
      ];

      for (const slot of slotTimes) {
        const startsAt = new Date(now);
        startsAt.setDate(now.getDate() + dayOffset);
        startsAt.setHours(slot.hour, slot.minute, 0, 0);

        const endsAt = new Date(
          startsAt.getTime() + (selectedMovie.durationMinutes + cleaningBufferMinutes) * 60000,
        );

        showDocs.push({
          movie: selectedMovie._id,
          screen: scr._id,
          startsAt,
          endsAt,
          language: selectedMovie.languages[0],
          format: scr.name.includes('IMAX') ? 'IMAX' : '2D',
          priceByCategory: defaultPriceByCat,
          currency: 'INR',
          status: 'SCHEDULED',
        });
      }
    }
  }

  const createdShows = await Show.insertMany(showDocs);
  console.log(`[Seed] Created ${createdShows.length} scheduled shows.`);

  // Generate ShowSeat documents for each show
  let totalSeatsCreated = 0;
  for (const sh of createdShows) {
    const scr = screensList.find((s) => s._id.toString() === sh.screen.toString())!;
    const rowLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.slice(0, scr.seatLayout.rows);
    const seatDocs = [];

    for (let rIdx = 0; rIdx < rowLetters.length; rIdx++) {
      const rowLetter = rowLetters[rIdx];
      const category = (scr.seatLayout.rowCategories as any)?.[rowLetter] || 'SILVER';
      const priceInPaise =
        (sh.priceByCategory as Record<string, number>)[category] || 15000;

      for (let c = 1; c <= scr.seatLayout.columns; c++) {
        const seatLabel = `${rowLetter}${c}`;
        if (scr.seatLayout.gapSeats?.includes(seatLabel)) {
          continue; // Skip architectural gaps
        }

        seatDocs.push({
          show: sh._id,
          seatLabel,
          row: rowLetter,
          number: c,
          category,
          priceInPaise,
          currency: 'INR',
          status: 'AVAILABLE',
          heldBy: null,
          holdExpiresAt: null,
          booking: null,
        });
      }
    }

    await ShowSeat.insertMany(seatDocs);
    totalSeatsCreated += seatDocs.length;
  }
  console.log(`[Seed] Generated ${totalSeatsCreated} individual ShowSeat documents.`);

  // 6. Create 1 pre-existing Confirmed Booking with Tickets for Staff Scanner Demo
  console.log('[Seed] Creating demo confirmed booking and valid ticket...');
  const firstShow = createdShows[0];
  const seatsToBook = await ShowSeat.find({ show: firstShow._id }).limit(2);

  const bookingRef = generateReference('BK');
  const totalAmountInPaise = seatsToBook.reduce((sum, s) => sum + s.priceInPaise, 0);

  const booking = await Booking.create({
    reference: bookingRef,
    user: customer1._id,
    show: firstShow._id,
    seats: seatsToBook.map((s) => s._id),
    seatSnapshots: seatsToBook.map((s) => ({
      seatId: s._id as any,
      seatLabel: s.seatLabel,
      category: s.category,
      priceInPaise: s.priceInPaise,
    })),
    totalAmountInPaise,
    currency: 'INR',
    status: 'CONFIRMED',
    expiresAt: new Date(Date.now() + 10 * 60000),
  });

  // Mark seats as BOOKED
  await ShowSeat.updateMany(
    { _id: { $in: seatsToBook.map((s) => s._id) } },
    { $set: { status: 'BOOKED', booking: booking._id } },
  );

  // Create payment record
  const payment = await Payment.create({
    booking: booking._id,
    amountInPaise: totalAmountInPaise,
    currency: 'INR',
    status: 'SUCCESS',
    refundStatus: 'NONE',
    transactionReference: generateReference('TXN'),
    gatewayOutcome: 'MOCK_SUCCESS',
    paidAt: new Date(),
  });

  // Create tickets with signed QR tokens
  for (const s of seatsToBook) {
    const ticketRef = generateReference('TKT');
    const qrToken = generateQrToken({
      ticketId: s._id.toString(),
      ticketReference: ticketRef,
      bookingReference: booking.reference,
      showId: firstShow._id.toString(),
    });

    await Ticket.create({
      reference: ticketRef,
      booking: booking._id,
      showSeat: s._id,
      show: firstShow._id,
      qrToken,
      status: 'VALID',
    });
  }

  // Create audit log entry
  await AuditLog.create({
    actorType: 'USER',
    actorId: customer1._id,
    action: 'BOOKING_CONFIRM',
    entity: 'Booking',
    entityId: booking._id.toString(),
    details: {
      bookingReference: booking.reference,
      seatsCount: seatsToBook.length,
      totalAmountInPaise,
    },
    requestId: 'seed-runner',
  });

  console.log('[Seed] Seeding completed successfully!');
  console.log(`[Seed] Demo Admin: admin@algions.com / Password123!`);
  console.log(`[Seed] Demo Staff: staff@algions.com / Password123!`);
  console.log(`[Seed] Demo Customer: customer1@algions.com / Password123!`);
  console.log(`[Seed] Demo Booking Reference: ${booking.reference}`);
}

// Allow direct CLI invocation
if (process.argv[1]?.includes('seed')) {
  runSeed()
    .then(async () => {
      await mongoose.disconnect();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('[Seed] Error running seed:', err);
      await mongoose.disconnect();
      process.exit(1);
    });
}

