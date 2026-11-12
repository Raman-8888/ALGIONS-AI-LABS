import dotenv from 'dotenv';
import path from 'path';

// Load root or local .env
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config();

function formatMongoUri(rawUri?: string): string {
  let uri = rawUri || process.env.MONGODB_URI || process.env.mongo_db_uri || 'mongodb://127.0.0.1:27017/cinema_db';
  // Strip quotes if any
  uri = uri.replace(/^["']|["']$/g, '').trim();

  // If URI ends with slash, default to cinema_db
  if (uri.endsWith('/')) {
    uri = `${uri}cinema_db?retryWrites=true&w=majority`;
  }
  return uri;
}

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000', 10),
  apiPrefix: process.env.API_PREFIX || '/api/v1',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  mongoUri: formatMongoUri(),
  jwt: {
    secret: process.env.JWT_SECRET || 'dev_jwt_secret_min_32_chars_long_1234567890',
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
    cookieName: 'access_token',
  },
  cookieSecret: process.env.COOKIE_SECRET || 'dev_cookie_secret_key',
  qrHmacSecret: process.env.QR_HMAC_SECRET || 'dev_qr_hmac_secret_key',
  businessRules: {
    holdMinutes: parseInt(process.env.HOLD_MINUTES || '5', 10),
    maxSeatsPerBooking: parseInt(process.env.MAX_SEATS_PER_BOOKING || '8', 10),
    cancellationCutoffMinutes: parseInt(process.env.CANCELLATION_CUTOFF_MINUTES || '60', 10),
    refundPercentage: parseInt(process.env.REFUND_PERCENTAGE || '100', 10),
    holdSweeperIntervalMs: parseInt(process.env.HOLD_SWEEPER_INTERVAL_MS || '30000', 10),
  },
};

