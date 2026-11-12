import { Theatre } from '../../db/models/Theatre.js';
import { Screen } from '../../db/models/Screen.js';
import { Show } from '../../db/models/Show.js';
import { AppError } from '../../common/errors/AppError.js';
import { logAudit } from '../../common/audit/auditLogger.js';
import { CreateTheatreInput, UpdateTheatreInput } from './theatres.validation.js';

export class TheatresService {
  static async listTheatres(city?: string) {
    const filter: Record<string, any> = { isActive: true };
    if (city) {
      filter.city = new RegExp(`^${city}$`, 'i');
    }
    return Theatre.find(filter).sort({ name: 1 }).lean();
  }

  static async getTheatreById(id: string) {
    const theatre = await Theatre.findById(id).lean();
    if (!theatre) {
      throw AppError.notFound(`Theatre with id ${id} not found`);
    }
    const screens = await Screen.find({ theatre: id, isActive: true }).lean();
    return { ...theatre, screens };
  }

  static async createTheatre(input: CreateTheatreInput, actorId: string, requestId = 'system') {
    const theatre = await Theatre.create(input);

    await logAudit({
      actorType: 'USER',
      actorId,
      action: 'THEATRE_CREATE',
      entity: 'Theatre',
      entityId: theatre._id.toString(),
      details: { name: theatre.name, city: theatre.city },
      requestId,
    });

    return theatre;
  }

  static async updateTheatre(
    id: string,
    input: UpdateTheatreInput,
    actorId: string,
    requestId = 'system',
  ) {
    const theatre = await Theatre.findByIdAndUpdate(id, { $set: input }, { new: true });
    if (!theatre) {
      throw AppError.notFound(`Theatre with id ${id} not found`);
    }

    await logAudit({
      actorType: 'USER',
      actorId,
      action: 'THEATRE_UPDATE',
      entity: 'Theatre',
      entityId: id,
      details: input,
      requestId,
    });

    return theatre;
  }

  static async deleteTheatre(id: string, actorId: string, requestId = 'system') {
    // Guard: Prevent deletion if any screen in this theatre has scheduled shows
    const screens = await Screen.find({ theatre: id }).select('_id');
    const screenIds = screens.map((s) => s._id);

    const hasShows = await Show.exists({ screen: { $in: screenIds }, status: 'SCHEDULED' });
    if (hasShows) {
      throw AppError.conflict(
        'Cannot deactivate theatre: active scheduled shows exist on its screens.',
      );
    }

    const theatre = await Theatre.findByIdAndUpdate(
      id,
      { $set: { isActive: false } },
      { new: true },
    );
    if (!theatre) {
      throw AppError.notFound(`Theatre with id ${id} not found`);
    }

    await logAudit({
      actorType: 'USER',
      actorId,
      action: 'THEATRE_DELETE',
      entity: 'Theatre',
      entityId: id,
      details: { name: theatre.name },
      requestId,
    });

    return theatre;
  }
}

