import { Ticket } from '../../db/models/Ticket.js';
import { Booking } from '../../db/models/Booking.js';
import { Show } from '../../db/models/Show.js';
import { AppError } from '../../common/errors/AppError.js';
import { verifyQrToken } from '../../common/utils/index.js';
import { logAudit } from '../../common/audit/auditLogger.js';
import { AuthUser } from '../../common/middleware/auth.js';
import { ValidateTicketInput } from './tickets.validation.js';

export class TicketsService {
  private static ENTRY_WINDOW_BEFORE_MINUTES = 30;

  static async validateTicket(
    staffUser: AuthUser,
    input: ValidateTicketInput,
    requestId = 'system',
  ) {
    let resolvedReference: string | undefined = input.ticketReference;
    let expectedShowId: string | undefined;

    // 1. Verify HMAC QR token if provided
    if (input.qrToken) {
      try {
        const decoded = verifyQrToken(input.qrToken);
        resolvedReference = decoded.ticketReference;
        expectedShowId = decoded.showId;
      } catch (err: any) {
        throw AppError.unprocessable('Invalid or expired QR token cryptographic signature');
      }

      // Check token show against active auditorium show
      if (expectedShowId !== input.activeShowId) {
        throw AppError.unprocessable(
          'Show mismatch: this ticket was issued for a different showtime or auditorium.',
          {
            expectedShowId: input.activeShowId,
            ticketShowId: expectedShowId,
          },
        );
      }
    }

    if (!resolvedReference) {
      throw AppError.badRequest('Ticket reference could not be resolved');
    }

    // 2. Fetch Ticket
    const ticket = await Ticket.findOne({ reference: resolvedReference }).lean();
    if (!ticket) {
      throw AppError.notFound(`Ticket with reference "${resolvedReference}" not found`);
    }

    // Verify ticket show matches active auditorium show (for manual reference lookup)
    if (ticket.show.toString() !== input.activeShowId) {
      throw AppError.unprocessable(
        'Show mismatch: this ticket was issued for a different showtime or auditorium.',
        {
          expectedShowId: input.activeShowId,
          ticketShowId: ticket.show.toString(),
        },
      );
    }

    // 3. Verify Parent Booking state
    const booking = await Booking.findById(ticket.booking).lean();
    if (!booking) {
      throw AppError.notFound('Parent booking for this ticket was not found');
    }

    if (booking.status === 'CANCELLED') {
      throw AppError.unprocessable(
        'Admission denied: booking associated with this ticket was cancelled and refunded.',
        { bookingReference: booking.reference },
      );
    }

    if (booking.status !== 'CONFIRMED') {
      throw AppError.unprocessable(
        `Admission denied: booking is not confirmed (status: ${booking.status}).`,
      );
    }

    // 4. Verify Show & Entry Window Timing
    const show = await Show.findById(ticket.show).lean();
    if (!show || show.status === 'CANCELLED') {
      throw AppError.unprocessable('Admission denied: show has been cancelled');
    }

    const now = Date.now();
    const entryOpenTime =
      new Date(show.startsAt).getTime() - TicketsService.ENTRY_WINDOW_BEFORE_MINUTES * 60 * 1000;
    const entryCloseTime = new Date(show.endsAt).getTime();

    if (now < entryOpenTime) {
      throw AppError.unprocessable(
        'Admission denied: auditorium doors have not opened yet. Entry opens 30 minutes before showtime.',
        {
          startsAt: show.startsAt,
          entryOpensAt: new Date(entryOpenTime),
        },
      );
    }

    if (now > entryCloseTime) {
      throw AppError.unprocessable(
        'Admission denied: this show has already concluded.',
        { endsAt: show.endsAt },
      );
    }

    // 5. ATOMIC SINGLE-USE STATE CHANGE: findOneAndUpdate where status = VALID
    // Prevents double-scan race conditions if two scanners process the same ticket simultaneously
    const updatedTicket = await Ticket.findOneAndUpdate(
      {
        _id: ticket._id,
        status: 'VALID',
      },
      {
        $set: {
          status: 'USED',
          validatedAt: new Date(),
          validatedBy: staffUser.id,
        },
      },
      { new: true },
    ).populate('showSeat', 'seatLabel category');

    if (!updatedTicket) {
      throw AppError.conflict(
        `Ticket admission failed: ticket is already ${ticket.status} and cannot be reused.`,
        {
          ticketReference: ticket.reference,
          status: ticket.status,
          validatedAt: ticket.validatedAt,
        },
      );
    }

    // 6. Audit Log
    await logAudit({
      actorType: 'USER',
      actorId: staffUser.id,
      action: 'TICKET_VALIDATE',
      entity: 'Ticket',
      entityId: updatedTicket._id.toString(),
      details: {
        ticketReference: updatedTicket.reference,
        bookingId: booking._id.toString(),
        seatLabel: (updatedTicket.showSeat as any)?.seatLabel,
        validatedByStaff: staffUser.name,
      },
      requestId,
    });

    return {
      valid: true,
      ticket: {
        id: updatedTicket._id.toString(),
        reference: updatedTicket.reference,
        status: updatedTicket.status,
        seatLabel: (updatedTicket.showSeat as any)?.seatLabel,
        category: (updatedTicket.showSeat as any)?.category,
        validatedAt: updatedTicket.validatedAt,
        staffName: staffUser.name,
      },
    };
  }
}

