import mongoose from 'mongoose';
import { ShowSeat } from '../../db/models/ShowSeat.js';
import { Show } from '../../db/models/Show.js';
import { AppError } from '../../common/errors/AppError.js';
import { config } from '../../common/config/index.js';
import { logAudit } from '../../common/audit/auditLogger.js';
import { withTransaction } from '../../common/utils/transaction.js';
import { CreateHoldInput, ReleaseHoldInput } from './holds.validation.js';

export class HoldsService {
  static async createHold(userId: string, input: CreateHoldInput, requestId = 'system') {
    const show = await Show.findById(input.showId).lean();
    if (!show) {
      throw AppError.notFound(`Show with id ${input.showId} not found`);
    }

    if (show.status === 'CANCELLED') {
      throw AppError.badRequest('Cannot hold seats for a cancelled show');
    }

    const now = new Date();
    if (show.startsAt <= now) {
      throw AppError.badRequest('Cannot hold seats for a past or in-progress show');
    }

    // 1. Anti-Hoarding Check: Cap total active holds per user per show
    const currentActiveHolds = await ShowSeat.countDocuments({
      show: input.showId,
      heldBy: userId,
      status: 'HELD',
      holdExpiresAt: { $gt: now },
    });

    const maxAllowed = config.businessRules.maxSeatsPerBooking; // default: 8
    if (currentActiveHolds + input.seatIds.length > maxAllowed) {
      throw AppError.unprocessable(
        `Seat hold limit exceeded: you can hold at most ${maxAllowed} seats per show. You currently have ${currentActiveHolds} active holds.`,
        {
          currentActiveHolds,
          requestedCount: input.seatIds.length,
          maxAllowed,
        },
      );
    }

    // 2. Atomic Multi-Seat Hold Acquisition inside MongoDB ACID Transaction
    return withTransaction(async (session) => {
      const holdExpiresAt = new Date(
        Date.now() + config.businessRules.holdMinutes * 60 * 1000,
      );

      // Match seats that are either AVAILABLE or whose hold has EXPIRED
      const filter = {
        _id: { $in: input.seatIds },
        show: input.showId,
        $or: [
          { status: 'AVAILABLE' },
          { status: 'HELD', holdExpiresAt: { $lt: now } },
        ],
      };

      const update = {
        $set: {
          status: 'HELD',
          heldBy: userId,
          holdExpiresAt,
        },
      };

      const updateResult = await ShowSeat.updateMany(filter, update, { session });

      // If not all requested seats were successfully transitioned, roll back
      if (updateResult.modifiedCount !== input.seatIds.length) {
        // Query which seats failed the condition
        const conflictingSeats = await ShowSeat.find({
          _id: { $in: input.seatIds },
          show: input.showId,
          $or: [
            { status: 'BOOKED' },
            {
              status: 'HELD',
              holdExpiresAt: { $gt: now },
              heldBy: { $ne: new mongoose.Types.ObjectId(userId) },
            },
          ],
        })
          .select('seatLabel')
          .session(session)
          .lean();

        const conflictLabels = conflictingSeats.map((s) => s.seatLabel);

        throw AppError.conflict(
          'One or more requested seats are no longer available. Please select different seats.',
          { conflictingSeats: conflictLabels },
        );
      }

      // Fetch the newly held seats for response and audit
      const heldSeats = await ShowSeat.find({ _id: { $in: input.seatIds } })
        .session(session)
        .lean();

      const totalAmountInPaise = heldSeats.reduce((sum, s) => sum + s.priceInPaise, 0);

      // Write Audit Log
      await logAudit({
        actorType: 'USER',
        actorId: userId,
        action: 'HOLD_ACQUIRED',
        entity: 'ShowSeat',
        entityId: input.showId,
        details: {
          seatLabels: heldSeats.map((s) => s.seatLabel),
          seatCount: heldSeats.length,
          holdExpiresAt,
          totalAmountInPaise,
        },
        requestId,
        session,
      });

      return {
        showId: input.showId,
        heldSeats: heldSeats.map((s) => ({
          id: s._id.toString(),
          seatLabel: s.seatLabel,
          category: s.category,
          priceInPaise: s.priceInPaise,
        })),
        holdExpiresAt,
        holdSecondsRemaining: Math.floor((holdExpiresAt.getTime() - Date.now()) / 1000),
        totalAmountInPaise,
        currency: 'INR',
      };
    });
  }

  static async releaseHold(userId: string, input: ReleaseHoldInput, requestId = 'system') {
    const result = await ShowSeat.updateMany(
      {
        _id: { $in: input.seatIds },
        show: input.showId,
        heldBy: userId,
        status: 'HELD',
      },
      {
        $set: {
          status: 'AVAILABLE',
          heldBy: null,
          holdExpiresAt: null,
        },
      },
    );

    if (result.modifiedCount > 0) {
      await logAudit({
        actorType: 'USER',
        actorId: userId,
        action: 'HOLD_RELEASED',
        entity: 'ShowSeat',
        entityId: input.showId,
        details: {
          releasedCount: result.modifiedCount,
          seatIds: input.seatIds,
        },
        requestId,
      });
    }

    return {
      releasedCount: result.modifiedCount,
    };
  }

  static async getActiveHolds(userId: string, showId: string) {
    const now = new Date();
    const activeSeats = await ShowSeat.find(
      {
        show: showId,
        heldBy: userId,
        status: 'HELD',
        holdExpiresAt: { $gt: now },
      },
      '_id seatLabel row number category priceInPaise currency holdExpiresAt',
    ).lean();

    return activeSeats.map((s) => ({
      id: s._id.toString(),
      seatLabel: s.seatLabel,
      row: s.row,
      number: s.number,
      category: s.category,
      priceInPaise: s.priceInPaise,
      currency: s.currency,
      holdExpiresAt: s.holdExpiresAt,
      holdSecondsRemaining: s.holdExpiresAt
        ? Math.max(0, Math.floor((new Date(s.holdExpiresAt).getTime() - now.getTime()) / 1000))
        : 0,
    }));
  }
}

