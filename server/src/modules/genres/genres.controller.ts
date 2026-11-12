import { Request, Response, NextFunction } from 'express';
import { GenresService } from './genres.service.js';

export class GenresController {
  static async list(_req: Request, res: Response, next: NextFunction) {
    try {
      const genres = await GenresService.listGenres();
      res.status(200).json({ data: { genres } });
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const genre = await GenresService.createGenre(req.body);
      res.status(201).json({ message: 'Genre created successfully', data: { genre } });
    } catch (error) {
      next(error);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await GenresService.deleteGenre(req.params.id);
      res.status(200).json({ message: 'Genre deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
}

