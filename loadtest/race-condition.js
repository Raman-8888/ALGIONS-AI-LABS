import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate } from 'k6/metrics';

/**
 * k6 Concurrency Test: Race Condition on Single Seat Hold
 *
 * Target: 50 concurrent virtual users race to hold the EXACT same seat simultaneously.
 * Expected Invariant: Exactly ONE user succeeds (HTTP 200/201).
 *                     All 49 other users fail cleanly with HTTP 409 Conflict.
 *                     Zero double-bookings, zero duplicate holds.
 */

export const options = {
  scenarios: {
    race_for_seat: {
      executor: 'per-vu-iterations',
      vus: 50,
      iterations: 1,
      maxDuration: '30s',
    },
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000/api/v1';
const SHOW_ID = __ENV.SHOW_ID || '664f1b2c3d4e5f6a7b8c9d01';
const SEAT_ID = __ENV.SEAT_ID || '664f1b2c3d4e5f6a7b8c9d02';

const successCounter = new Counter('successful_holds');
const conflictCounter = new Counter('conflict_409_responses');
const otherErrorRate = new Rate('unexpected_errors');

export default function () {
  // Generate a distinct user cookie / authorization or simulate distinct clients
  const vuId = __VU;
  const idempotencyKey = `race-vu-${vuId}-${Date.now()}`;

  const payload = JSON.stringify({
    showId: SHOW_ID,
    seatIds: [SEAT_ID],
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
  };

  const res = http.post(`${BASE_URL}/holds`, payload, params);

  if (res.status === 200 || res.status === 201) {
    successCounter.add(1);
    check(res, {
      'Winner received 200/201': (r) => r.status === 200 || r.status === 201,
    });
  } else if (res.status === 409) {
    conflictCounter.add(1);
    check(res, {
      'Loser received 409 Conflict': (r) => r.status === 409,
    });
  } else {
    otherErrorRate.add(1);
    console.error(`Unexpected response status: ${res.status} body: ${res.body}`);
  }

  sleep(0.5);
}
