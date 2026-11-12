import { Request, Response, NextFunction } from 'express';
import { TheatresService } from './theatres.service.js';

export class TheatresController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const theatres = await TheatresService.listTheatres(req.query.city as string);
      res.status(200).json({ data: { theatres } });
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const theatre = await TheatresService.getTheatreById(req.params.id);
      res.status(200).json({ data: { theatre } });
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const theatre = await TheatresService.createTheatre(req.body, req.user!.id, req.id);
      res.status(201).json({ message: 'Theatre created successfully', data: { theatre } });
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const theatre = await TheatresService.updateTheatre(
        req.params.id,
        req.body,
        req.user!.id,
        req.id,
      );
      res.status(200).json({ message: 'Theatre updated successfully', data: { theatre } });
    } catch (error) {
      next(error);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await TheatresService.deleteTheatre(req.params.id, req.user!.id, req.id);
      res.status(200).json({ message: 'Theatre deactivated successfully' });
    } catch (error) {
      next(error);
    }
  }
}

