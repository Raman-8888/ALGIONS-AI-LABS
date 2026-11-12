import { Genre } from '../../db/models/Genre.js';
import { AppError } from '../../common/errors/AppError.js';
import { CreateGenreInput } from './genres.validation.js';

export class GenresService {
  static async listGenres() {
    return Genre.find().sort({ name: 1 }).lean();
  }

  static async createGenre(input: CreateGenreInput) {
    const slug = input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const existing = await Genre.findOne({ $or: [{ name: input.name }, { slug }] });
    if (existing) {
      throw AppError.conflict(`Genre "${input.name}" already exists`);
    }

    return Genre.create({
      name: input.name,
      slug,
    });
  }

  static async deleteGenre(id: string) {
    const genre = await Genre.findByIdAndDelete(id);
    if (!genre) {
      throw AppError.notFound(`Genre with id ${id} not found`);
    }
    return genre;
  }
}

