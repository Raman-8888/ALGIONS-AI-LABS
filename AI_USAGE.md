# AI Usage & Attribution Log

In accordance with academic and assessment integrity guidelines, this log records the use of AI assistance during the development of the Cinema Hall Ticket Booking System.

| Phase | AI Role | Scope of AI Assistance | Human Review & Verification |
|---|---|---|---|
| Phase 0 | Planning & Architecture Partner | Plan confirmation, requirements breakdown, risk analysis, assumptions mapping. | Human reviewed architecture, validated constraints, approved phase boundaries. |
| Phase 1 | Scaffolding & Infrastructure Specialist | Monorepo scaffolding, npm workspaces, TypeScript compiler config, Docker Compose with Mongo replica set, Nginx load balancer configuration, Ponytail YAGNI principles. | Human verified builds, reviewed Docker Compose architecture, tested vitest suite. |
| Phase 2 | Senior Data Modeling & Concurrency Architect | Fixed schedule overlap race condition with Screen.scheduleVersion serialization, partial unique indexes for payment retries, two-phase booking state machine with 'Paid but no seat' auto-refund fallback, multi-seat atomic holds and anti-hoarding cap, append-only AuditLog, and full seed script. | Human reviewed architectural fixes in docs/architecture-reference.md and verified Vitest schema test suite. |
| Phase 3 | Security & Core Infrastructure Engineer | Standardized AppError and Global Error Handler with requestId envelope, Zod validation middleware, JWT in httpOnly cookie + bcrypt authentication, role-based access control (RBAC), sanitized append-only audit logging helper, race-free Idempotency reservation with payload hashing, and rate limiting. | Human reviewed security invariants, verified Vitest integration tests (auth, RBAC, idempotency, validation). |
| Phase 4 | Domain Engineering & Concurrency Specialist | Built admin CRUD for genres, movies, theatres, screens, and shows. Implemented withTransaction retry wrapper, screen scheduleVersion locking to serialize concurrent show scheduling, 15m cleaning buffer overlap checks, atomic ShowSeat document generation, soft-delete integrity guards, and transactional show cancellation cascade with booking/ticket invalidation and refund triggers. | Human verified clean TypeScript build and 26/26 passing Vitest integration tests. |

