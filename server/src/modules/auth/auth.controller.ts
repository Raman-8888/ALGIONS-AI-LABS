import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service.js';
import { config } from '../../common/config/index.js';

export class AuthController {
  private static setAuthCookie(res: Response, token: string) {
    res.cookie(config.jwt.cookieName, token, {
      httpOnly: true,
      secure: config.env === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    });
  }

  static async register(req: Request, res: Response, next: NextFunction) {
    try {
      const { user, token } = await AuthService.register(req.body, req.id);
      AuthController.setAuthCookie(res, token);
      res.status(201).json({
        message: 'Account created successfully',
        data: { user, token },
      });
    } catch (error) {
      next(error);
    }
  }

  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { user, token } = await AuthService.login(req.body, req.id);
      AuthController.setAuthCookie(res, token);
      res.status(200).json({
        message: 'Signed in successfully',
        data: { user, token },
      });
    } catch (error) {
      next(error);
    }
  }

  static async logout(_req: Request, res: Response) {
    res.clearCookie(config.jwt.cookieName, {
      httpOnly: true,
      secure: config.env === 'production',
      sameSite: 'lax',
    });
    res.status(200).json({ message: 'Signed out successfully' });
  }

  static async me(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await AuthService.getMe(req.user!.id);
      res.status(200).json({ data: { user } });
    } catch (error) {
      next(error);
    }
  }
}

