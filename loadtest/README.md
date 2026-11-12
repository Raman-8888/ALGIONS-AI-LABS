# k6 Load Testing Suite

This directory contains high-concurrency k6 load test scripts designed to validate:
1. **Race Condition Resilience**: 200 virtual users (VUs) simultaneously racing for 10 seats on a single show (`race-condition.js`).
2. **Mixed Realistic Traffic**: 2-minute sustained load with mixed browse/hold/book/cancel traffic (`mixed-traffic.js`).
3. **Hold Expiry Under Load**: Validating seats properly return to availability upon hold expiration.

## Running Tests
Ensure k6 is installed locally or via Docker:
```bash
k6 run loadtest/race-condition.js
k6 run loadtest/mixed-traffic.js
```

Benchmark output and latency percentiles (p50, p95, p99) will be recorded in `loadtest/results.md`.

