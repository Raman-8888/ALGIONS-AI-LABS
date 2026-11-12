import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

/**
 * Generate cryptographically secure random alphanumeric reference
 * Format: PREFIX-YYYYMMDD-XXXXXX (e.g. BK-20261112-9A4F2C)
 */
export function generateReference(prefix: 'BK' | 'TKT' | 'TXN'): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomChars = crypto.randomBytes(4).toString('hex').toUpperCase(); // 8 hex chars
  return `${prefix}-${dateStr}-${randomChars}`;
}

/**
 * Generate signed HMAC QR token for ticket entry
 */
export function generateQrToken(payload: {
  ticketId: string;
  ticketReference: string;
  bookingReference: string;
  showId: string;
}): string {
  return jwt.sign(payload, config.qrHmacSecret, {
    algorithm: 'HS256',
    expiresIn: '7d',
  });
}

/**
 * Verify HMAC QR token
 */
export function verifyQrToken(token: string): {
  ticketId: string;
  ticketReference: string;
  bookingReference: string;
  showId: string;
} {
  return jwt.verify(token, config.qrHmacSecret) as any;
}

/**
 * Compute SHA-256 hash of request payload for idempotency verification
 */
export function computePayloadHash(payload: any): string {
  const stringified = typeof payload === 'string' ? payload : JSON.stringify(payload || {});
  return crypto.createHash('sha256').update(stringified).digest('hex');
}

