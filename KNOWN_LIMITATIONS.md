# Known Limitations & Tradeoffs

This document tracks known limitations, scope boundaries, and architectural tradeoffs made during development.

## 1. Concurrency & Seat Holds
- **Expiry Sweep Cadence**: Background hold cleanup runs on a periodic interval (e.g., every 30s) or via worker. Expired holds are also lazily evaluated as available in real-time read queries and atomic conditional updates, preventing stale lock windows between background sweep cycles.
- **Transactions vs Distributed Sharding**: MongoDB multi-document ACID transactions are scoped to a replica set or mongos router in sharded clusters. In this MVP, all collections reside within the primary replica set.

## 2. Payments
- **Simulated Gateway**: The payment gateway is purely simulated for educational and assessment purposes with deterministically simulated success, failure, and timeout scenarios. No real PCI-DSS or payment credentials are required or processed.

## 3. Real-time Updates (Tier 1 vs Tier 2)
- In Tier 1, real-time live seat maps rely on client polling / refetching on hold action. Tier 2 (Socket.IO + Redis adapter) will be added only after acceptance criteria pass.

## 4. Multi-Replica Rate Limiting
- In Tier 1, memory-based rate limiting operates on a per-instance basis across the 3 API replicas. A shared distributed rate limiter backed by Redis is scheduled for Tier 2.

