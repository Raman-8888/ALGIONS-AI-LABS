import { Show } from '../../db/models/Show.js';
import { ShowSeat } from '../../db/models/ShowSeat.js';
import { Booking } from '../../db/models/Booking.js';
import { Payment } from '../../db/models/Payment.js';
import { ReportQueryInput } from './reports.validation.js';

export class ReportsService {
  /**
   * Acceptance Test 5: Occupancy report == confirmed bookings minus cancellations.
   */
  static async getOccupancyReport(query: ReportQueryInput) {
    const showFilter: Record<string, any> = { status: 'SCHEDULED' };

    if (query.movieId) {
      showFilter.movie = query.movieId;
    }

    if (query.dateFrom || query.dateTo) {
      showFilter.startsAt = {};
      if (query.dateFrom) {
        showFilter.startsAt.$gte = new Date(`${query.dateFrom}T00:00:00.000Z`);
      }
      if (query.dateTo) {
        showFilter.startsAt.$lte = new Date(`${query.dateTo}T23:59:59.999Z`);
      }
    }

    const shows = await Show.find(showFilter)
      .populate('movie', 'title durationMinutes posterUrl')
      .populate({
        path: 'screen',
        select: 'name theatre totalSeats',
        populate: { path: 'theatre', select: 'name city' },
      })
      .sort({ startsAt: 1 })
      .lean();

    let totalCapacity = 0;
    let totalBooked = 0;
    let totalHeld = 0;
    let totalAvailable = 0;

    const breakdown = await Promise.all(
      shows.map(async (sh) => {
        const [totalSeats, bookedSeats, heldSeats, availableSeats] = await Promise.all([
          ShowSeat.countDocuments({ show: sh._id }),
          ShowSeat.countDocuments({ show: sh._id, status: 'BOOKED' }),
          ShowSeat.countDocuments({ show: sh._id, status: 'HELD' }),
          ShowSeat.countDocuments({ show: sh._id, status: 'AVAILABLE' }),
        ]);

        totalCapacity += totalSeats;
        totalBooked += bookedSeats;
        totalHeld += heldSeats;
        totalAvailable += availableSeats;

        const occupancyRate =
          totalSeats > 0 ? Number(((bookedSeats / totalSeats) * 100).toFixed(1)) : 0;

        return {
          showId: sh._id.toString(),
          movieTitle: (sh.movie as any)?.title || 'Unknown',
          screenName: (sh.screen as any)?.name || 'Unknown',
          theatreName: (sh.screen as any)?.theatre?.name || 'Unknown',
          city: (sh.screen as any)?.theatre?.city || 'Unknown',
          startsAt: sh.startsAt,
          format: sh.format,
          totalSeats,
          bookedSeats, // Confirmed bookings minus cancellations
          heldSeats,
          availableSeats,
          occupancyPercentage: occupancyRate,
        };
      }),
    );

    const overallOccupancyRate =
      totalCapacity > 0 ? Number(((totalBooked / totalCapacity) * 100).toFixed(1)) : 0;

    return {
      summary: {
        showsCount: shows.length,
        totalCapacity,
        totalBooked,
        totalHeld,
        totalAvailable,
        overallOccupancyPercentage: overallOccupancyRate,
      },
      shows: breakdown,
    };
  }

  static async getSalesReport(query: ReportQueryInput) {
    // 1. Confirmed Bookings Gross Revenue
    const bookingFilter: Record<string, any> = { status: 'CONFIRMED' };

    if (query.dateFrom || query.dateTo) {
      bookingFilter.createdAt = {};
      if (query.dateFrom) {
        bookingFilter.createdAt.$gte = new Date(`${query.dateFrom}T00:00:00.000Z`);
      }
      if (query.dateTo) {
        bookingFilter.createdAt.$lte = new Date(`${query.dateTo}T23:59:59.999Z`);
      }
    }

    const confirmedBookings = await Booking.find(bookingFilter)
      .populate({
        path: 'show',
        populate: [
          { path: 'movie', select: 'title genres' },
          { path: 'screen', populate: { path: 'theatre', select: 'name city' } },
        ],
      })
      .lean();

    const grossRevenueInPaise = confirmedBookings.reduce(
      (sum, b) => sum + b.totalAmountInPaise,
      0,
    );

    // 2. Refunds
    const refundedPayments = await Payment.find({
      refundStatus: { $in: ['REFUND_PENDING', 'REFUNDED'] },
    }).lean();

    const totalRefundedInPaise = refundedPayments.reduce(
      (sum, p) => sum + p.refundAmountInPaise,
      0,
    );

    const netRevenueInPaise = Math.max(0, grossRevenueInPaise - totalRefundedInPaise);

    // 3. Breakdown by Movie
    const movieBreakdown = new Map<string, { title: string; ticketsCount: number; grossPaise: number }>();
    for (const b of confirmedBookings) {
      const movie = (b.show as any)?.movie;
      if (!movie) continue;
      const mId = movie._id.toString();

      if (!movieBreakdown.has(mId)) {
        movieBreakdown.set(mId, { title: movie.title, ticketsCount: 0, grossPaise: 0 });
      }

      const item = movieBreakdown.get(mId)!;
      item.ticketsCount += b.seats.length;
      item.grossPaise += b.totalAmountInPaise;
    }

    return {
      financials: {
        currency: 'INR',
        grossRevenueInPaise,
        grossRevenueRupees: grossRevenueInPaise / 100,
        refundedRevenueInPaise: totalRefundedInPaise,
        refundedRevenueRupees: totalRefundedInPaise / 100,
        netRevenueInPaise,
        netRevenueRupees: netRevenueInPaise / 100,
        confirmedBookingsCount: confirmedBookings.length,
        refundsCount: refundedPayments.length,
      },
      movieSales: Array.from(movieBreakdown.values()),
    };
  }
}

