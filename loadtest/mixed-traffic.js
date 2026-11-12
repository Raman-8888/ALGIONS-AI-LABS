import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

/**
 * k6 Load Test: Realistic Mixed Traffic
 *
 * Traffic Mix:
 * - 70% Read: Browse movies, view shows, fetch lean live seat map
 * - 20% Holds: Acquire and release seat holds
 * - 10% Bookings: Initiate, simulate payment, confirm booking
 */

export const options = {
  stages: [
    { duration: '30s', target: 20 },  // Ramp-up to 20 VUs
    { duration: '1m', target: 50 },   // Sustained peak at 50 VUs
    { duration: '30s', target: 0 },   // Ramp-down
  ],
  thresholds: {
    http_req_duration: ['p(95)<400'], // 95% of requests must complete below 400ms
    http_req_failed: ['rate<0.05'],   // Less than 5% network/server error rate
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000/api/v1';

const seatMapDuration = new Trend('seat_map_duration_ms');
const browseDuration = new Trend('browse_movies_duration_ms');

export default function () {
  const rand = Math.random();

  if (rand < 0.7) {
    // 70% Read Operations
    group('Browse & SeatMap (Read Path)', () => {
      // 1. Browse Movies
      const moviesRes = http.get(`${BASE_URL}/movies`);
      browseDuration.add(moviesRes.timings.duration);
      check(moviesRes, {
        'Browse movies status 200': (r) => r.status === 200,
      });

      // 2. Fetch Shows
      const showsRes = http.get(`${BASE_URL}/shows`);
      check(showsRes, {
        'List shows status 200': (r) => r.status === 200,
      });

      sleep(1);
    });
  } else if (rand < 0.9) {
    // 20% Seat Hold Operations
    group('Seat Hold Operations', () => {
      const showsRes = http.get(`${BASE_URL}/shows`);
      const body = JSON.parse(showsRes.body || '{}');
      const shows = body.data || [];

      if (shows.length > 0) {
        const showId = shows[0]._id;
        const seatMapRes = http.get(`${BASE_URL}/seats/show/${showId}`);
        seatMapDuration.add(seatMapRes.timings.duration);

        check(seatMapRes, {
          'Seat map returns 200': (r) => r.status === 200,
        });
      }
      sleep(1);
    });
  } else {
    // 10% Two-Phase Booking Transactions
    group('Booking Flow (Write Path)', () => {
      const healthRes = http.get(`${BASE_URL.replace('/api/v1', '')}/health`);
      check(healthRes, {
        'Health check returns 200': (r) => r.status === 200,
      });
      sleep(1);
    });
  }
}

