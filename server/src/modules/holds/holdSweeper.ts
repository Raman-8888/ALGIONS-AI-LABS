import { ShowSeat } from '../../db/models/ShowSeat.js';
import { logAudit } from '../../common/audit/auditLogger.js';

export class HoldSweeper {
  /**
   * Sweeps expired holds and releases them back to AVAILABLE.
   * Safe to run concurrently across multiple instances (idempotent conditional update).
   */
  static async sweepExpiredHolds(): Promise<number> {
    const now = new Date();

    const expiredSeats = await ShowSeat.find(
      {
        status: 'HELD',
        holdExpiresAt: { $lt: now },
      },
      '_id show seatLabel heldBy',
    ).lean();

    if (expiredSeats.length === 0) {
      return 0;
    }

    const expiredIds = expiredSeats.map((s) => s._id);

    const result = await ShowSeat.updateMany(
      {
        _id: { $in: expiredIds },
        status: 'HELD',
        holdExpiresAt: { $lt: now },
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
      console.log(`[HoldSweeper] Released ${result.modifiedCount} expired seat holds.`);

      await logAudit({
        actorType: 'SYSTEM',
        actorId: null,
        action: 'HOLD_EXPIRED',
        entity: 'ShowSeat',
        entityId: 'batch',
        details: {
          releasedCount: result.modifiedCount,
          seatLabels: expiredSeats.map((s) => s.seatLabel),
        },
        requestId: 'hold-sweeper-job',
      });
    }

    return result.modifiedCount;
  }
}

