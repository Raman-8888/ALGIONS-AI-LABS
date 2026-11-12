import { Screen } from '../../db/models/Screen.js';
import { Theatre } from '../../db/models/Theatre.js';
import { Show } from '../../db/models/Show.js';
import { AppError } from '../../common/errors/AppError.js';
import { logAudit } from '../../common/audit/auditLogger.js';
import { CreateScreenInput, UpdateScreenInput } from './screens.validation.js';

export class ScreensService {
  static async getScreenById(id: string) {
    const screen = await Screen.findById(id).lean({ virtuals: true });
    if (!screen) {
      throw AppError.notFound(`Screen with id ${id} not found`);
    }
    return screen;
  }

  static async createScreen(input: CreateScreenInput, actorId: string, requestId = 'system') {
    const theatre = await Theatre.findById(input.theatre);
    if (!theatre || !theatre.isActive) {
      throw AppError.notFound('Theatre not found or inactive');
    }

    // Verify row category mappings cover all rows
    const rowLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.slice(0, input.seatLayout.rows);
    for (const r of rowLetters) {
      if (!input.seatLayout.rowCategories[r]) {
        throw AppError.badRequest(
          `Seat layout missing category mapping for row "${r}". All rows (A-${rowLetters[rowLetters.length - 1]}) must be mapped.`,
        );
      }
    }

    const screen = await Screen.create(input);

    await logAudit({
      actorType: 'USER',
      actorId,
      action: 'SCREEN_CREATE',
      entity: 'Screen',
      entityId: screen._id.toString(),
      details: { name: screen.name, theatreId: screen.theatre },
      requestId,
    });

    return screen;
  }

  static async updateScreen(
    id: string,
    input: UpdateScreenInput,
    actorId: string,
    requestId = 'system',
  ) {
    const screen = await Screen.findByIdAndUpdate(id, { $set: input }, { new: true });
    if (!screen) {
      throw AppError.notFound(`Screen with id ${id} not found`);
    }

    await logAudit({
      actorType: 'USER',
      actorId,
      action: 'SCREEN_UPDATE',
      entity: 'Screen',
      entityId: id,
      details: input,
      requestId,
    });

    return screen;
  }

  static async deleteScreen(id: string, actorId: string, requestId = 'system') {
    // Guard: Prevent deletion if scheduled shows exist on this screen
    const hasScheduledShows = await Show.exists({ screen: id, status: 'SCHEDULED' });
    if (hasScheduledShows) {
      throw AppError.conflict(
        'Cannot deactivate screen: active scheduled shows are currently booked or scheduled on it.',
      );
    }

    const screen = await Screen.findByIdAndUpdate(
      id,
      { $set: { isActive: false } },
      { new: true },
    );
    if (!screen) {
      throw AppError.notFound(`Screen with id ${id} not found`);
    }

    await logAudit({
      actorType: 'USER',
      actorId,
      action: 'SCREEN_DELETE',
      entity: 'Screen',
      entityId: id,
      details: { name: screen.name },
      requestId,
    });

    return screen;
  }
}

