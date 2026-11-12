import mongoose from 'mongoose';
import { Booking, IBooking } from '../../db/models/Booking.js';
import { ShowSeat } from '../../db/models/ShowSeat.js';
import { Show } from '../../db/models/Show.js';
import { Payment } from '../../db/models/Payment.js';
import { Ticket } from '../../db/models/Ticket.js';
import { AppError } from '../../common/errors/AppError.js';
import { config } from '../../common/config/index.js';
import { generateReference, generateQrToken } from '../../common/utils/index.js';
import { withTransaction } from '../../common/utils/transaction.js';
import { logAudit } from '../../common/audit/auditLogger.js';
import { PaymentsService } from '../payments/payments.service.js';
import { InitiateBookingInput, CheckoutInput } from './bookings.validation.js';

export class BookingsService {
  private static PAYMENT_GRACE_PERIOD_MINUTES = 2;

  /**
   * Step 1: Initiate Booking (creates PENDING_PAYMENT booking and snapshots prices)
   */
  static async initiateBooking(
    userId: string,
    input: InitiateBookingInput,
    requestId = 'system',
  ) {
    const show = await Show.findById(input.showId).lean();
    if (!show || show.status === 'CANCELLED') {
      throw AppError.notFound('Show not found or cancelled');
    }

    const now = new Date();

    // 1. Verify all requested seats are currently held by this user and not expired
    const heldSeats = await ShowSeat.find({
      _id: { $in: input.seatIds },
      show: input.showId,
      heldBy: userId,
      status: 'HELD',
      holdExpiresAt: { $gt: now },
    }).lean();

    if (heldSeats.length !== input.seatIds.length) {
      throw AppError.badRequest(
        'One or more selected seats are not actively held by you or have already expired. Please reselect your seats.',
      );
    }

    // 2. Extend hold with grace period to protect customer during checkout
    const extendedExpiry = new Date(
      Date.now() + BookingsService.PAYMENT_GRACE_PERIOD_MINUTES * 60 * 1000,
    );

    await ShowSeat.updateMany(
      { _id: { $in: input.seatIds } },
      { $set: { holdExpiresAt: extendedExpiry } },
    );

    // 3. Generate snapshot of prices and total amount
    const seatSnapshots = heldSeats.map((s) => ({
      seatId: s._id as any,
      seatLabel: s.seatLabel,
      category: s.category,
      priceInPaise: s.priceInPaise,
    }));

    const totalAmountInPaise = seatSnapshots.reduce((sum, s) => sum + s.priceInPaise, 0);

    // 4. Create Booking record in PENDING_PAYMENT state
    const reference = generateReference('BK');

    const booking = await Booking.create({
      reference,
      user: userId,
      show: input.showId,
      seats: input.seatIds,
      seatSnapshots,
      totalAmountInPaise,
      currency: 'INR',
      status: 'PENDING_PAYMENT',
      expiresAt: extendedExpiry,
    });

    await logAudit({
      actorType: 'USER',
      actorId: userId,
      action: 'BOOKING_INITIATED',
      entity: 'Booking',
      entityId: booking._id.toString(),
      details: {
        bookingReference: reference,
        totalAmountInPaise,
        seatCount: seatSnapshots.length,
      },
      requestId,
    });

    return {
      bookingId: booking._id.toString(),
      reference: booking.reference,
      totalAmountInPaise,
      currency: booking.currency,
      expiresAt: booking.expiresAt,
      seatSnapshots,
    };
  }

  /**
   * Step 2 & 3 Combined: End-to-End Idempotent Checkout Pipeline
   */
  static async checkout(userId: string, input: CheckoutInput, requestId = 'system') {
    // Step 1: Initiate booking record
    const initiated = await this.initiateBooking(
      userId,
      { showId: input.showId, seatIds: input.seatIds },
      requestId,
    );

    // Step 2: Simulate Payment Gateway (strictly OUTSIDE DB transaction)
    const payment = await PaymentsService.simulatePayment(
      userId,
      {
        bookingId: initiated.bookingId,
        gatewayOutcome: input.gatewayOutcome,
      },
      requestId,
    );

    // Step 3: Confirm Booking inside a MongoDB ACID transaction
    return this.confirmBooking(
      userId,
      initiated.bookingId,
      payment._id.toString(),
      requestId,
    );
  }

  /**
   * Step 3: Confirm Booking Transaction (with "Paid But No Seat" Refund Fallback)
   */
  static async confirmBooking(
    userId: string,
    bookingId: string,
    paymentId: string,
    requestId = 'system',
  ) {
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      throw AppError.notFound(`Booking with id ${bookingId} not found`);
    }

    if (booking.user.toString() !== userId) {
      throw AppError.forbidden('You do not have permission to confirm this booking');
    }

    const payment = await Payment.findById(paymentId);
    if (!payment || payment.status !== 'SUCCESS') {
      throw AppError.badRequest('A successful payment is required to confirm this booking');
    }

    return withTransaction(async (session) => {
      const now = new Date();

      // 1. Single conditional updateMany on ShowSeat: transition HELD -> BOOKED
      const seatResult = await ShowSeat.updateMany(
        {
          _id: { $in: booking.seats },
          status: 'HELD',
          heldBy: userId,
          holdExpiresAt: { $gt: now },
        },
        {
          $set: { status: 'BOOKED', booking: booking._id },
          $unset: { heldBy: '', holdExpiresAt: '' },
        },
        { session },
      );

      // 2. THE "PAID BUT NO SEAT" FALLBACK RULE:
      // If hold lapsed during payment execution and seats were taken
      if (seatResult.modifiedCount !== booking.seats.length) {
        // Rollback booking state & flag payment for automatic refund
        booking.status = 'EXPIRED';
        await booking.save({ session });

        payment.refundStatus = 'REFUND_PENDING';
        payment.refundAmountInPaise = booking.totalAmountInPaise;
        await payment.save({ session });

        await logAudit({
          actorType: 'SYSTEM',
          actorId: null,
          action: 'PAYMENT_CONFIRM_RACE_REFUND_TRIGGERED',
          entity: 'Payment',
          entityId: payment._id.toString(),
          details: {
            bookingId: booking._id.toString(),
            refundAmountInPaise: booking.totalAmountInPaise,
            reason: 'Seat hold expired before confirmation completed',
          },
          requestId,
          session,
        });

        // Persist the EXPIRED and REFUND_PENDING states before exiting
        await session.commitTransaction();

        throw AppError.conflict(
          'Your seat hold expired while processing payment. All requested seats could not be secured. A 100% full refund has been automatically initiated.',
          {
            refundStatus: 'REFUND_PENDING',
            refundAmountInPaise: booking.totalAmountInPaise,
            bookingReference: booking.reference,
          },
        );
      }

      // 3. Mark booking as CONFIRMED
      booking.status = 'CONFIRMED';
      await booking.save({ session });

      // 4. Generate Ticket documents with signed HMAC QR tokens
      const tickets = [];
      for (const seatId of booking.seats) {
        const ticketRef = generateReference('TKT');
        const qrToken = generateQrToken({
          ticketId: seatId.toString(),
          ticketReference: ticketRef,
          bookingReference: booking.reference,
          showId: booking.show.toString(),
        });

        const [tkt] = await Ticket.create(
          [
            {
              reference: ticketRef,
              booking: booking._id,
              showSeat: seatId,
              show: booking.show,
              qrToken,
              status: 'VALID',
            },
          ],
          { session },
        );
        tickets.push(tkt);
      }

      // 5. Emit Audit Record
      await logAudit({
        actorType: 'USER',
        actorId: userId,
        action: 'BOOKING_CONFIRM',
        entity: 'Booking',
        entityId: booking._id.toString(),
        details: {
          bookingReference: booking.reference,
          ticketsGenerated: tickets.length,
          totalAmountInPaise: booking.totalAmountInPaise,
        },
        requestId,
        session,
      });

      return {
        booking: {
          id: booking._id.toString(),
          reference: booking.reference,
          status: booking.status,
          totalAmountInPaise: booking.totalAmountInPaise,
          currency: booking.currency,
          seatSnapshots: booking.seatSnapshots,
          createdAt: booking.createdAt,
        },
        payment: {
          id: payment._id.toString(),
          transactionReference: payment.transactionReference,
          status: payment.status,
          amountInPaise: payment.amountInPaise,
          paidAt: payment.paidAt,
        },
        tickets: tickets.map((t) => ({
          id: t._id.toString(),
          reference: t.reference,
          qrToken: t.qrToken,
          status: t.status,
        })),
      };
    });
  }

  static async getMyBookings(userId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [bookings, total] = await Promise.all([
      Booking.find({ user: userId })
        .populate({
          path: 'show',
          populate: [
            { path: 'movie', select: 'title posterUrl durationMinutes languages' },
            {
              path: 'screen',
              select: 'name theatre',
              populate: { path: 'theatre', select: 'name city timezone' },
            },
          ],
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Booking.countDocuments({ user: userId }),
    ]);

    // Attach tickets for confirmed bookings
    const bookingIds = bookings.map((b) => b._id);
    const tickets = await Ticket.find({ booking: { $in: bookingIds } })
      .populate('showSeat', 'seatLabel category priceInPaise')
      .lean();

    const ticketsByBooking = new Map<string, any[]>();
    for (const t of tickets) {
      const bId = t.booking.toString();
      if (!ticketsByBooking.has(bId)) {
        ticketsByBooking.set(bId, []);
      }
      ticketsByBooking.get(bId)!.push({
        ...t,
        seatLabel: (t.showSeat as any)?.seatLabel || 'Admission',
        category: (t.showSeat as any)?.category,
      });
    }

    const enriched = bookings.map((b) => ({
      ...b,
      tickets: ticketsByBooking.get(b._id.toString()) || [],
    }));

    return {
      bookings: enriched,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async cancelBooking(
    userId: string,
    bookingId: string,
    reason = 'CUSTOMER_REQUESTED',
    isAdmin = false,
    requestId = 'system',
  ) {
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      throw AppError.notFound(`Booking with id ${bookingId} not found`);
    }

    if (!isAdmin && booking.user.toString() !== userId) {
      throw AppError.forbidden('You do not have permission to cancel this booking');
    }

    if (booking.status !== 'CONFIRMED') {
      throw AppError.badRequest(
        `Only CONFIRMED bookings can be cancelled. Current status is ${booking.status}.`,
      );
    }

    const show = await Show.findById(booking.show).lean();
    if (!show) {
      throw AppError.notFound('Show associated with this booking not found');
    }

    // Cutoff Window Check: must be at least CANCELLATION_CUTOFF_MINUTES before showtime
    const cutoffMinutes = config.businessRules.cancellationCutoffMinutes; // default: 60 mins
    const cutoffThresholdMs = cutoffMinutes * 60 * 1000;
    const timeUntilShowMs = new Date(show.startsAt).getTime() - Date.now();

    if (!isAdmin && timeUntilShowMs < cutoffThresholdMs) {
      throw AppError.unprocessable(
        `Cancellation window has closed. Bookings can only be cancelled at least ${cutoffMinutes} minutes prior to showtime.`,
        {
          cutoffMinutes,
          timeRemainingMinutes: Math.max(0, Math.floor(timeUntilShowMs / 60000)),
        },
      );
    }

    // Compute refund amount based on config percentage
    const refundPercentage = config.businessRules.refundPercentage; // 100%
    const refundAmountInPaise = Math.round(
      (booking.totalAmountInPaise * refundPercentage) / 100,
    );

    return withTransaction(async (session) => {
      const now = new Date();

      // 1. Update Booking state
      booking.status = 'CANCELLED';
      booking.cancelledAt = now;
      booking.cancelledBy = new mongoose.Types.ObjectId(userId);
      booking.cancellationReason = reason;
      await booking.save({ session });

      // 2. Release ShowSeats back to AVAILABLE
      await ShowSeat.updateMany(
        { _id: { $in: booking.seats } },
        {
          $set: { status: 'AVAILABLE', booking: null },
          $unset: { heldBy: '', holdExpiresAt: '' },
        },
        { session },
      );

      // 3. Mark Tickets as CANCELLED
      await Ticket.updateMany(
        { booking: booking._id },
        { $set: { status: 'CANCELLED' } },
        { session },
      );

      // 4. Update Payment to REFUND_PENDING
      await Payment.updateMany(
        { booking: booking._id, status: 'SUCCESS' },
        {
          $set: {
            refundStatus: 'REFUND_PENDING',
            refundAmountInPaise,
            refundedAt: now,
          },
        },
        { session },
      );

      // 5. Audit Log
      await logAudit({
        actorType: 'USER',
        actorId: userId,
        action: 'BOOKING_CANCEL',
        entity: 'Booking',
        entityId: booking._id.toString(),
        details: {
          bookingReference: booking.reference,
          refundAmountInPaise,
          refundPercentage,
          reason,
        },
        requestId,
        session,
      });

      return {
        bookingId: booking._id.toString(),
        reference: booking.reference,
        status: booking.status,
        refund: {
          refundStatus: 'REFUND_PENDING',
          refundAmountInPaise,
          refundPercentage,
        },
      };
    });
  }

  static async getBookingById(userId: string, bookingId: string) {
    const booking = await Booking.findById(bookingId)
      .populate({
        path: 'show',
        populate: [
          { path: 'movie', select: 'title posterUrl durationMinutes languages' },
          {
            path: 'screen',
            select: 'name theatre',
            populate: { path: 'theatre', select: 'name city timezone address' },
          },
        ],
      })
      .lean();

    if (!booking) {
      throw AppError.notFound(`Booking with id ${bookingId} not found`);
    }

    if (booking.user.toString() !== userId) {
      throw AppError.forbidden('You do not have permission to view this booking');
    }

    const tickets = await Ticket.find({ booking: booking._id }).lean();
    const payments = await Payment.find({ booking: booking._id }).lean();

    return {
      ...booking,
      tickets,
      payments,
    };
  }
}

