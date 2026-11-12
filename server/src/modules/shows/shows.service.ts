import mongoose from 'mongoose';
import { Show } from '../../db/models/Show.js';
import { ShowSeat } from '../../db/models/ShowSeat.js';
import { Screen } from '../../db/models/Screen.js';
import { Movie } from '../../db/models/Movie.js';
import { Booking } from '../../db/models/Booking.js';
import { Ticket } from '../../db/models/Ticket.js';
import { Payment } from '../../db/models/Payment.js';
import { AppError } from '../../common/errors/AppError.js';
import { logAudit } from '../../common/audit/auditLogger.js';
import { withTransaction } from '../../common/utils/transaction.js';
import { CreateShowInput, ShowQueryInput } from './shows.validation.js';

export class ShowsService {
  private static CLEANING_BUFFER_MINUTES = 15;

  static async listShows(query: ShowQueryInput) {
    const filter: Record<string, any> = { status: 'SCHEDULED' };

    if (query.movieId) {
      filter.movie = query.movieId;
    }
    if (query.format) {
      filter.format = query.format;
    }
    if (query.language) {
      filter.language = query.language;
    }

    if (query.date) {
      const startOfDay = new Date(`${query.date}T00:00:00.000Z`);
      const endOfDay = new Date(`${query.date}T23:59:59.999Z`);
      filter.startsAt = { $gte: startOfDay, $lte: endOfDay };
    }

    if (query.theatreId) {
      const screens = await Screen.find({ theatre: query.theatreId, isActive: true }).select('_id');
      const screenIds = screens.map((s) => s._id);
      filter.screen = { $in: screenIds };
    }

    return Show.find(filter)
      .populate('movie', 'title durationMinutes posterUrl languages genres')
      .populate('screen', 'name theatre totalSeats')
      .sort({ startsAt: 1 })
      .lean();
  }

  static async getShowById(id: string) {
    const show = await Show.findById(id)
      .populate('movie')
      .populate('screen')
      .lean();

    if (!show) {
      throw AppError.notFound(`Show with id ${id} not found`);
    }
    return show;
  }

  static async createShow(input: CreateShowInput, actorId: string, requestId = 'system') {
    const startsAt = new Date(input.startsAt);
    const now = new Date();

    // Guard: Prevent scheduling in the past
    if (startsAt <= now) {
      throw AppError.badRequest('Show time cannot be set in the past');
    }

    return withTransaction(async (session) => {
      // 1. Fetch movie & screen
      const movie = await Movie.findById(input.movieId).session(session);
      if (!movie || !movie.isActive) {
        throw AppError.notFound('Movie not found or inactive');
      }

      // 2. Atomic serialization lock on Screen (increments scheduleVersion)
      const screen = await Screen.findByIdAndUpdate(
        input.screenId,
        { $inc: { scheduleVersion: 1 } },
        { session, new: true },
      );
      if (!screen || !screen.isActive) {
        throw AppError.notFound('Screen not found or inactive');
      }

      // 3. Compute endsAt with cleaning buffer
      const totalDuration = movie.durationMinutes + ShowsService.CLEANING_BUFFER_MINUTES;
      const endsAt = new Date(startsAt.getTime() + totalDuration * 60000);

      // 4. Overlap check on this screen
      const overlappingShow = await Show.findOne({
        screen: screen._id,
        status: 'SCHEDULED',
        startsAt: { $lt: endsAt },
        endsAt: { $gt: startsAt },
      }).session(session);

      if (overlappingShow) {
        throw AppError.conflict(
          'Screen scheduling conflict: another show is already scheduled during this time slot (including 15m cleaning buffer).',
          {
            conflictingShowId: overlappingShow._id,
            startsAt: overlappingShow.startsAt,
            endsAt: overlappingShow.endsAt,
          },
        );
      }

      // 5. Validate priceByCategory covers all screen categories
      const rowCategoriesMap = screen.seatLayout.rowCategories as any;
      const requiredCategories = new Set(
        rowCategoriesMap instanceof Map
          ? Array.from(rowCategoriesMap.values())
          : Object.values(rowCategoriesMap || {}),
      );

      for (const cat of requiredCategories) {
        const catStr = String(cat);
        if (input.priceByCategory[catStr] === undefined || input.priceByCategory[catStr] < 0) {
          throw AppError.unprocessable(
            `Missing or invalid price for seat category "${catStr}". All screen categories must have a valid price in paise.`,
            { requiredCategories: Array.from(requiredCategories) },
          );
        }
      }

      // 6. Create Show document
      const [show] = await Show.create(
        [
          {
            movie: movie._id,
            screen: screen._id,
            startsAt,
            endsAt,
            language: input.language,
            format: input.format,
            priceByCategory: input.priceByCategory,
            currency: 'INR',
            status: 'SCHEDULED',
          },
        ],
        { session },
      );

      // 7. Bulk generate ShowSeat documents
      const rowLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.slice(0, screen.seatLayout.rows);
      const seatDocs = [];

      for (let rIdx = 0; rIdx < rowLetters.length; rIdx++) {
        const rowLetter = rowLetters[rIdx];
        const category =
          rowCategoriesMap instanceof Map
            ? rowCategoriesMap.get(rowLetter) || 'SILVER'
            : rowCategoriesMap[rowLetter] || 'SILVER';
        const priceInPaise = input.priceByCategory[category] ?? 15000;

        for (let c = 1; c <= screen.seatLayout.columns; c++) {
          const seatLabel = `${rowLetter}${c}`;
          if (screen.seatLayout.gapSeats?.includes(seatLabel)) {
            continue; // Skip architectural voids/gaps
          }

          seatDocs.push({
            show: show._id,
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

      await ShowSeat.insertMany(seatDocs, { session });

      // 8. Write Audit Log
      await logAudit({
        actorType: 'USER',
        actorId,
        action: 'SHOW_CREATE',
        entity: 'Show',
        entityId: show._id.toString(),
        details: {
          movieTitle: movie.title,
          screenName: screen.name,
          startsAt: show.startsAt,
          seatsGenerated: seatDocs.length,
        },
        requestId,
        session,
      });

      return show;
    });
  }

  static async cancelShow(id: string, actorId: string, requestId = 'system') {
    return withTransaction(async (session) => {
      const show = await Show.findById(id).session(session);
      if (!show) {
        throw AppError.notFound(`Show with id ${id} not found`);
      }

      if (show.status === 'CANCELLED') {
        throw AppError.badRequest('This show has already been cancelled');
      }

      // 1. Mark show as CANCELLED
      show.status = 'CANCELLED';
      await show.save({ session });

      // 2. Release all ShowSeat documents for this show back to AVAILABLE
      await ShowSeat.updateMany(
        { show: show._id },
        {
          $set: { status: 'AVAILABLE', booking: null },
          $unset: { heldBy: '', holdExpiresAt: '' },
        },
        { session },
      );

      // 3. Find and cascade-cancel all CONFIRMED bookings for this show
      const confirmedBookings = await Booking.find({
        show: show._id,
        status: 'CONFIRMED',
      }).session(session);

      const bookingIds = confirmedBookings.map((b) => b._id);

      if (bookingIds.length > 0) {
        // Cancel Bookings
        await Booking.updateMany(
          { _id: { $in: bookingIds } },
          {
            $set: {
              status: 'CANCELLED',
              cancelledAt: new Date(),
              cancelledBy: actorId,
              cancellationReason: 'SHOW_CANCELLED_BY_ADMIN',
            },
          },
          { session },
        );

        // Cancel Tickets
        await Ticket.updateMany(
          { booking: { $in: bookingIds } },
          { $set: { status: 'CANCELLED' } },
          { session },
        );

        // Flag payments for 100% full refund
        for (const b of confirmedBookings) {
          await Payment.updateMany(
            { booking: b._id, status: 'SUCCESS' },
            {
              $set: {
                refundStatus: 'REFUND_PENDING',
                refundAmountInPaise: b.totalAmountInPaise,
              },
            },
            { session },
          );
        }
      }

      // 4. Write Audit Log
      await logAudit({
        actorType: 'USER',
        actorId,
        action: 'SHOW_CANCEL',
        entity: 'Show',
        entityId: id,
        details: {
          cancelledBookingsCount: bookingIds.length,
          reason: 'SHOW_CANCELLED_BY_ADMIN',
        },
        requestId,
        session,
      });

      return show;
    });
  }
}

