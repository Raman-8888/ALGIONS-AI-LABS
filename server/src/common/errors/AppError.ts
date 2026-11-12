export type ErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'UNPROCESSABLE_ENTITY'
  | 'TOO_MANY_REQUESTS'
  | 'INTERNAL_SERVER_ERROR';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly details?: Record<string, any>;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number,
    code: ErrorCode,
    details?: Record<string, any>,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message: string, details?: Record<string, any>) {
    return new AppError(message, 400, 'BAD_REQUEST', details);
  }

  static unauthorized(message = 'Authentication required', details?: Record<string, any>) {
    return new AppError(message, 401, 'UNAUTHORIZED', details);
  }

  static forbidden(message = 'Insufficient permissions', details?: Record<string, any>) {
    return new AppError(message, 403, 'FORBIDDEN', details);
  }

  static notFound(message = 'Resource not found', details?: Record<string, any>) {
    return new AppError(message, 404, 'NOT_FOUND', details);
  }

  static conflict(message: string, details?: Record<string, any>) {
    return new AppError(message, 409, 'CONFLICT', details);
  }

  static unprocessable(message: string, details?: Record<string, any>) {
    return new AppError(message, 422, 'UNPROCESSABLE_ENTITY', details);
  }

  static tooManyRequests(message = 'Rate limit exceeded, please try again later') {
    return new AppError(message, 429, 'TOO_MANY_REQUESTS');
  }

  static internal(message = 'An unexpected internal error occurred') {
    return new AppError(message, 500, 'INTERNAL_SERVER_ERROR');
  }
}

