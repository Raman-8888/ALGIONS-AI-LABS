import { Request, Response, NextFunction } from 'express';
import { ScreensService } from './screens.service.js';

export class ScreensController {
  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const screen = await ScreensService.getScreenById(req.params.id);
      res.status(200).json({ data: { screen } });
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const screen = await ScreensService.createScreen(req.body, req.user!.id, req.id);
      res.status(201).json({ message: 'Screen created successfully', data: { screen } });
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const screen = await ScreensService.updateScreen(
        req.params.id,
        req.body,
        req.user!.id,
        req.id,
      );
      res.status(200).json({ message: 'Screen updated successfully', data: { screen } });
    } catch (error) {
      next(error);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await ScreensService.deleteScreen(req.params.id, req.user!.id, req.id);
      res.status(200).json({ message: 'Screen deactivated successfully' });
    } catch (error) {
      next(error);
    }
  }
}

