import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, IUser, UserRole } from '../../db/models/User.js';
import { AppError } from '../../common/errors/AppError.js';
import { config } from '../../common/config/index.js';
import { logAudit } from '../../common/audit/auditLogger.js';
import { RegisterInput, LoginInput } from './auth.validation.js';

export class AuthService {
  private static generateToken(user: IUser): string {
    return jwt.sign(
      {
        sub: user._id.toString(),
        email: user.email,
        role: user.role,
        tokenVersion: user.tokenVersion,
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn as any },
    );
  }

  static async register(input: RegisterInput, requestId = 'system') {
    const existing = await User.findOne({ email: input.email }).collation({
      locale: 'en',
      strength: 2,
    });

    if (existing) {
      throw AppError.conflict('An account with this email address already exists');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(input.password, salt);

    // Security invariant: public registration ALWAYS defaults to CUSTOMER role
    const user = await User.create({
      email: input.email,
      passwordHash,
      name: input.name,
      role: 'CUSTOMER',
      isActive: true,
      tokenVersion: 0,
    });

    const token = this.generateToken(user);

    await logAudit({
      actorType: 'USER',
      actorId: user._id,
      action: 'USER_REGISTER',
      entity: 'User',
      entityId: user._id.toString(),
      details: { email: user.email, role: user.role },
      requestId,
    });

    return {
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
      },
      token,
    };
  }

  static async login(input: LoginInput, requestId = 'system') {
    const user = await User.findOne({ email: input.email }).collation({
      locale: 'en',
      strength: 2,
    });

    if (!user) {
      throw AppError.unauthorized('Invalid email or password');
    }

    if (!user.isActive) {
      throw AppError.forbidden('This user account has been deactivated');
    }

    const isMatch = await bcrypt.compare(input.password, user.passwordHash);
    if (!isMatch) {
      throw AppError.unauthorized('Invalid email or password');
    }

    const token = this.generateToken(user);

    await logAudit({
      actorType: 'USER',
      actorId: user._id,
      action: 'USER_LOGIN',
      entity: 'User',
      entityId: user._id.toString(),
      details: { email: user.email },
      requestId,
    });

    return {
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
      },
      token,
    };
  }

  static async getMe(userId: string) {
    const user = await User.findById(userId).lean();
    if (!user || !user.isActive) {
      throw AppError.unauthorized('User not found or inactive');
    }

    return {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt,
    };
  }
}

