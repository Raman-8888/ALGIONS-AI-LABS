import { Movie } from '../../db/models/Movie.js';
import { Show } from '../../db/models/Show.js';
import { AppError } from '../../common/errors/AppError.js';
import { logAudit } from '../../common/audit/auditLogger.js';
import { CreateMovieInput, UpdateMovieInput, MovieQueryInput } from './movies.validation.js';

export class MoviesService {
  static async listMovies(query: MovieQueryInput) {
    const filter: Record<string, any> = { isActive: true };

    if (query.q) {
      filter.$text = { $search: query.q };
    }
    if (query.genre) {
      filter.genres = { $in: [query.genre] };
    }
    if (query.language) {
      filter.languages = { $in: [query.language] };
    }

    const page = query.page;
    const limit = query.limit;
    const skip = (page - 1) * limit;

    const [movies, total] = await Promise.all([
      Movie.find(filter)
        .sort(query.sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Movie.countDocuments(filter),
    ]);

    return {
      movies,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getMovieById(id: string) {
    const movie = await Movie.findById(id).lean();
    if (!movie) {
      throw AppError.notFound(`Movie with id ${id} not found`);
    }
    return movie;
  }

  static async createMovie(input: CreateMovieInput, actorId: string, requestId = 'system') {
    const movie = await Movie.create({
      ...input,
      releaseDate: new Date(input.releaseDate),
      isActive: true,
    });

    await logAudit({
      actorType: 'USER',
      actorId,
      action: 'MOVIE_CREATE',
      entity: 'Movie',
      entityId: movie._id.toString(),
      details: { title: movie.title },
      requestId,
    });

    return movie;
  }

  static async updateMovie(
    id: string,
    input: UpdateMovieInput,
    actorId: string,
    requestId = 'system',
  ) {
    const movie = await Movie.findById(id);
    if (!movie) {
      throw AppError.notFound(`Movie with id ${id} not found`);
    }

    const updates: Record<string, any> = { ...input };
    if (input.releaseDate) {
      updates.releaseDate = new Date(input.releaseDate);
    }

    Object.assign(movie, updates);
    await movie.save();

    await logAudit({
      actorType: 'USER',
      actorId,
      action: 'MOVIE_UPDATE',
      entity: 'Movie',
      entityId: movie._id.toString(),
      details: updates,
      requestId,
    });

    return movie;
  }

  static async deleteMovie(id: string, actorId: string, requestId = 'system') {
    // Guard: Prevent deletion if scheduled shows exist
    const hasScheduledShows = await Show.exists({ movie: id, status: 'SCHEDULED' });
    if (hasScheduledShows) {
      throw AppError.conflict(
        'Cannot delete or deactivate movie: active scheduled shows are linked to this movie.',
      );
    }

    const movie = await Movie.findByIdAndUpdate(
      id,
      { $set: { isActive: false } },
      { new: true },
    );
    if (!movie) {
      throw AppError.notFound(`Movie with id ${id} not found`);
    }

    await logAudit({
      actorType: 'USER',
      actorId,
      action: 'MOVIE_DELETE',
      entity: 'Movie',
      entityId: id,
      details: { title: movie.title },
      requestId,
    });

    return movie;
  }
}

