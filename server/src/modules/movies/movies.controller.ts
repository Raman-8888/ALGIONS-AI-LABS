import { Request, Response, NextFunction } from 'express';
import { MoviesService } from './movies.service.js';

export class MoviesController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await MoviesService.listMovies(req.query as any);
      res.status(200).json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const movie = await MoviesService.getMovieById(req.params.id);
      res.status(200).json({ data: { movie } });
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const movie = await MoviesService.createMovie(req.body, req.user!.id, req.id);
      res.status(201).json({ message: 'Movie created successfully', data: { movie } });
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const movie = await MoviesService.updateMovie(req.params.id, req.body, req.user!.id, req.id);
      res.status(200).json({ message: 'Movie updated successfully', data: { movie } });
    } catch (error) {
      next(error);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await MoviesService.deleteMovie(req.params.id, req.user!.id, req.id);
      res.status(200).json({ message: 'Movie deactivated successfully' });
    } catch (error) {
      next(error);
    }
  }
}

