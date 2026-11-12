# Cinema Hall Ticket Booking System - Architecture & Data Reference

## 1. Directory Structure

```
algions-cinema-hall-booking/
├── .env                              # Local environment secrets (not in git)
├── .env.example                      # Documented environment blueprint
├── .gitignore
├── .prettierrc
├── .prettierignore
├── AI_USAGE.md                       # Academic integrity AI attribution log
├── KNOWN_LIMITATIONS.md              # Architectural tradeoffs & boundaries
├── docker-compose.yml                # Mongo Replica Set + 3 API replicas + Worker + Nginx
├── nginx.conf                        # Reverse proxy load balancer config
├── package.json                      # Root workspace (server + client)
├── .github/
│   └── workflows/
│       └── ci.yml                    # Automated CI test workflow
├── docs/                             # Architecture & assessment documents
│   ├── architecture-reference.md     # This comprehensive guide
│   ├── er-diagram.md                 # Mermaid entity relationship chart
│   ├── openapi.yaml                  # Swagger 3.0 API specification
│   └── technical-report.md           # Engineering decisions & benchmark data
├── loadtest/                         # k6 load testing scripts
│   ├── race-condition.js
│   ├── mixed-traffic.js
│   └── results.md
├── server/                           # Backend Node.js + TypeScript (Express)
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   ├── vitest.config.ts
│   └── src/
│       ├── app.ts                    # Express app configuration & middlewares
│       ├── server.ts                 # HTTP server bootstrap & DB lifecycle
│       ├── worker.ts                 # Dedicated background job runner (hold sweeper)
│       ├── common/                   # Shared cross-cutting utilities
│       │   ├── config/               # Environment parsing & business constants
│       │   ├── errors/               # Standard AppError & HTTP status codes
│       │   ├── idempotency/          # Idempotency header guard & hash check
│       │   ├── middleware/           # Auth, RBAC, error handling, rate limiting
│       │   ├── utils/                # Crypto reference generator & token signer
│       │   └── validation/           # Zod schema validation middleware
│       ├── db/
│       │   ├── connection.ts         # Mongoose connection & pool config
│       │   ├── models/               # 11 Mongoose Schemas & Indexes
│       │   │   ├── User.ts
│       │   │   ├── Genre.ts
│       │   │   ├── Movie.ts
│       │   │   ├── Theatre.ts
│       │   │   ├── Screen.ts
│       │   │   ├── Show.ts
│       │   │   ├── ShowSeat.ts       # Critical concurrency unit
│       │   │   ├── Booking.ts
│       │   │   ├── Payment.ts
│       │   │   ├── Ticket.ts
│       │   │   ├── AuditLog.ts
│       │   │   └── IdempotencyKey.ts
│       │   └── seed/
│       │       └── seed.ts           # Demo users, movies, shows & seats
│       └── modules/                  # Modular monolith domains
│           ├── auth/                 # Register, login, logout, me
│           ├── users/                # Role management & audit
│           ├── movies/               # Discovery, admin CRUD
│           ├── theatres/             # Theatres & screen layouts
│           ├── shows/                # Scheduling, Screen version lock, ShowSeats
│           ├── seats/                # Live seat map & pricing query
│           ├── holds/                # Atomic conditional seat reservation & cap
│           ├── bookings/             # Multi-seat confirmation transaction
│           ├── payments/             # Simulated gateway & refund lifecycle
│           ├── tickets/              # HMAC QR generation & staff validation
│           ├── reports/              # Occupancy & sales aggregations
│           └── audit/                # Administrative audit log query
└── client/                           # Frontend React (Vite + TypeScript)
    ├── index.html
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── tailwind.config.js
    └── src/
        ├── App.tsx                   # Top-level routing & layout shell
        ├── main.tsx
        ├── api/                      # Typed fetch client with cookie auth
        ├── components/               # UI primitives (buttons, modals, badges)
        ├── hooks/                    # Auth, hold countdown timer, query hooks
        ├── pages/
        │   ├── Home.tsx              # Movie browsing & search
        │   ├── MovieDetails.tsx      # Movie info, trailer & showtimes
        │   ├── ShowPicker.tsx        # Date & theatre showtime selector
        │   ├── SeatMap.tsx           # Interactive seat grid & hold timer
        │   ├── Checkout.tsx          # Price summary & simulated payment
        │   ├── Confirmation.tsx      # Booking reference & QR token display
        │   ├── MyBookings.tsx        # Customer history & cancellation
        │   ├── StaffScanner.tsx      # Single-use ticket validation
        │   ├── Login.tsx             # Authentication form
        │   ├── Register.tsx          # Registration form (Customer only)
        │   ├── Forbidden403.tsx
        │   ├── NotFound404.tsx
        │   └── admin/
        │       ├── Dashboard.tsx     # Occupancy & sales charts
        │       ├── ShowsManager.tsx  # Showtime schedule creator
        │       ├── MoviesManager.tsx # Movie catalog CRUD
        │       ├── TheatresManager.tsx # Theatres & Screen layout editor
        │       └── AuditLogs.tsx     # System audit trail
        └── routes/                   # Protected customer/staff/admin routes
```

---

## 2. Revised Data Model & Index Specifications

### 1. User
- **Fields**:
  - `_id`: `ObjectId`
  - `email`: `String` (trimmed, lowercase, unique)
  - `passwordHash`: `String` (bcrypt)
  - `name`: `String` (trimmed)
  - `role`: `String` (`'CUSTOMER' | 'STAFF' | 'ADMIN'`, default: `'CUSTOMER'`)
  - `isActive`: `Boolean` (default: `true`)
  - `tokenVersion`: `Number` (default: `0`, incremented on password change / logout all)
  - `createdAt`, `updatedAt`: `Date`
- **Indexes**:
  - `{ email: 1 }` with `{ unique: true, collation: { locale: 'en', strength: 2 } }`

### 2. Theatre
- **Fields**:
  - `_id`: `ObjectId`
  - `name`: `String`
  - `city`: `String`
  - `address`: `String`
  - `timezone`: `String` (default: `'Asia/Kolkata'`)
  - `isActive`: `Boolean` (default: `true`)
  - `createdAt`, `updatedAt`: `Date`
- **Indexes**:
  - `{ city: 1, isActive: 1 }`

### 3. Screen
- **Fields**:
  - `_id`: `ObjectId`
  - `theatre`: `ObjectId` (ref: `Theatre`)
  - `name`: `String` (e.g., `'Audi 1'`, `'IMAX Hall'`)
  - `scheduleVersion`: `Number` (default: `0`, incremented inside show creation transaction to serialize schedule edits per screen)
  - `seatLayout`:
    - `rows`: `Number`
    - `columns`: `Number`
    - `aisleColumns`: `[Number]` (column indices representing aisles/walkways)
    - `gapSeats`: `[String]` (e.g., `['A1', 'A10']` for physical architectural voids)
    - `rowCategories`: `Map<String, String>` (mapping row letters e.g. `'A'` -> `'SILVER'`, `'E'` -> `'GOLD'`)
  - `isActive`: `Boolean` (default: `true`)
- **Virtuals**:
  - `totalSeats`: Derived dynamically: `(rows * columns) - gapSeats.length`
- **Indexes**:
  - `{ theatre: 1, name: 1 }` with `{ unique: true }`

### 4. Genre
- **Fields**: `_id`, `name` (unique, e.g. `'Action'`), `slug`
- **Indexes**: `{ name: 1 }` with `{ unique: true }`

### 5. Movie
- **Fields**:
  - `_id`: `ObjectId`
  - `title`: `String`
  - `description`: `String`
  - `durationMinutes`: `Number`
  - `languages`: `[String]`
  - `genres`: `[String]`
  - `posterUrl`: `String`
  - `trailerUrl`: `String`
  - `releaseDate`: `Date`
  - `isActive`: `Boolean` (default: `true`)
- **Indexes**:
  - `{ title: 'text' }` (Text search)
  - `{ genres: 1 }`
  - `{ languages: 1 }`
  - `{ releaseDate: 1 }`
  - `{ isActive: 1 }`

### 6. Show
- **Fields**:
  - `_id`: `ObjectId`
  - `movie`: `ObjectId` (ref: `Movie`)
  - `screen`: `ObjectId` (ref: `Screen`)
  - `startsAt`: `Date`
  - `endsAt`: `Date` (calculated as `startsAt + movie.durationMinutes + cleaningBufferMinutes`)
  - `language`: `String`
  - `format`: `String` (`'2D' | '3D' | 'IMAX'`)
  - `priceByCategory`: `Map<String, Number>` (integer paise: e.g. `{ SILVER: 15000, GOLD: 25000, PLATINUM: 40000 }`)
  - `currency`: `String` (default: `'INR'`)
  - `status`: `String` (`'SCHEDULED' | 'CANCELLED'`, default: `'SCHEDULED'`)
- **Virtuals**:
  - `isCompleted`: Derived: `new Date() > endsAt`
- **Indexes**:
  - `{ screen: 1, startsAt: 1, endsAt: 1 }`
  - `{ movie: 1, startsAt: 1 }`

### 7. ShowSeat (The Core Concurrency Engine)
- **Fields**:
  - `_id`: `ObjectId`
  - `show`: `ObjectId` (ref: `Show`)
  - `seatLabel`: `String` (uppercase trimmed, e.g. `'A1'`)
  - `row`: `String`
  - `number`: `Number`
  - `category`: `String` (`'SILVER' | 'GOLD' | 'PLATINUM'`)
  - `priceInPaise`: `Number` (integer minor units, >= 0)
  - `currency`: `String` (default: `'INR'`)
  - `status`: `String` (`'AVAILABLE' | 'HELD' | 'BOOKED'`, default: `'AVAILABLE'`)
  - `heldBy`: `ObjectId` (ref: `User`, null when AVAILABLE or BOOKED)
  - `holdExpiresAt`: `Date` (null when AVAILABLE or BOOKED)
  - `booking`: `ObjectId` (ref: `Booking`, null when AVAILABLE or HELD)
- **Indexes**:
  - `{ show: 1, seatLabel: 1 }` with `{ unique: true }`
  - `{ show: 1, status: 1, holdExpiresAt: 1 }`
  - `{ heldBy: 1, show: 1, status: 1 }`

### 8. Booking
- **Fields**:
  - `_id`: `ObjectId`
  - `reference`: `String` (Unique alphanumeric, e.g. `'BK-20261112-X7K9M2'`)
  - `user`: `ObjectId` (ref: `User`)
  - `show`: `ObjectId` (ref: `Show`)
  - `seats`: `[ObjectId]` (refs: `ShowSeat`)
  - `seatSnapshots`: `[{ seatId: ObjectId, seatLabel: String, category: String, priceInPaise: Number }]`
  - `totalAmountInPaise`: `Number`
  - `currency`: `String` (default: `'INR'`)
  - `status`: `String` (`'PENDING_PAYMENT' | 'CONFIRMED' | 'CANCELLED' | 'EXPIRED'`, default: `'PENDING_PAYMENT'`)
  - `expiresAt`: `Date` (payment timeout deadline)
  - `cancelledAt`: `Date`
  - `cancelledBy`: `ObjectId` (ref: `User`)
  - `cancellationReason`: `String`
  - `createdAt`, `updatedAt`: `Date`
- **Indexes**:
  - `{ reference: 1 }` with `{ unique: true }`
  - `{ user: 1, createdAt: -1 }`
  - `{ show: 1, status: 1 }`

### 9. Payment
- **Fields**:
  - `_id`: `ObjectId`
  - `booking`: `ObjectId` (ref: `Booking`)
  - `amountInPaise`: `Number`
  - `currency`: `String` (default: `'INR'`)
  - `status`: `String` (`'INITIATED' | 'SUCCESS' | 'FAILED'`)
  - `refundStatus`: `String` (`'NONE' | 'REFUND_PENDING' | 'REFUNDED'`, default: `'NONE'`)
  - `refundAmountInPaise`: `Number` (default: `0`)
  - `refundedAt`: `Date`
  - `transactionReference`: `String`
  - `gatewayOutcome`: `String` (`'MOCK_SUCCESS' | 'MOCK_FAIL' | 'MOCK_TIMEOUT'`)
  - `paidAt`: `Date`
  - `createdAt`, `updatedAt`: `Date`
- **Indexes**:
  - `{ booking: 1 }` (non-unique to permit retries after failure)
  - Partial unique index: `{ booking: 1 }` with `{ unique: true, partialFilterExpression: { status: 'SUCCESS' } }`

### 10. Ticket
- **Fields**:
  - `_id`: `ObjectId`
  - `reference`: `String` (Unique, e.g. `'TKT-7A8B9C12'`)
  - `booking`: `ObjectId` (ref: `Booking`)
  - `showSeat`: `ObjectId` (ref: `ShowSeat`)
  - `show`: `ObjectId` (ref: `Show`)
  - `qrToken`: `String` (Signed HMAC-SHA256 JWT with `{ ticketId, bookingRef, showId }`)
  - `status`: `String` (`'VALID' | 'USED' | 'CANCELLED'`, default: `'VALID'`)
  - `validatedAt`: `Date`
  - `validatedBy`: `ObjectId` (ref: `User`)
- **Indexes**:
  - `{ reference: 1 }` with `{ unique: true }`
  - `{ booking: 1 }`
  - `{ show: 1 }`

### 11. AuditLog (Append-Only)
- **Fields**:
  - `_id`: `ObjectId`
  - `actorType`: `String` (`'USER' | 'SYSTEM'`)
  - `actorId`: `ObjectId` (ref: `User`, null if SYSTEM)
  - `action`: `String` (`'SHOW_CREATE' | 'SHOW_CANCEL' | 'HOLD_ACQUIRED' | 'HOLD_EXPIRED' | 'BOOKING_CONFIRM' | 'BOOKING_CANCEL' | 'TICKET_VALIDATE' | 'ROLE_CHANGE'`)
  - `entity`: `String` (`'Show' | 'ShowSeat' | 'Booking' | 'Ticket' | 'User'`)
  - `entityId`: `String`
  - `details`: `Object` (Sanitized state changes; no passwords, tokens, or raw secrets)
  - `requestId`: `String`
  - `createdAt`: `Date`
- **Indexes**:
  - `{ entity: 1, entityId: 1, createdAt: -1 }`
  - `{ createdAt: -1 }`

### 12. IdempotencyKey
- **Fields**:
  - `_id`: `ObjectId`
  - `key`: `String` (Client-supplied UUID)
  - `user`: `ObjectId` (ref: `User`)
  - `requestPath`: `String`
  - `requestHash`: `String` (SHA-256 of request payload)
  - `status`: `String` (`'IN_PROGRESS' | 'COMPLETED'`)
  - `responseStatus`: `Number`
  - `responseBody`: `Object`
  - `expiresAt`: `Date` (TTL index)
- **Indexes**:
  - `{ key: 1, user: 1 }` with `{ unique: true }`
  - `{ expiresAt: 1 }` with `{ expireAfterSeconds: 0 }`

---

## 3. Concurrency, State Machines & Business Invariants

### 1. Show Scheduling Overlap Prevention
MongoDB lacks declarative multi-row range-exclusion constraints. To guarantee no overlapping shows occur on the same physical screen:
1. Start a MongoDB transaction.
2. Atomically update `Screen.findByIdAndUpdate(screenId, { $inc: { scheduleVersion: 1 } }, { session })`.
   - Any concurrent request attempting to schedule a show on the exact same screen will conflict at the document write lock level, triggering a write conflict or serializing execution.
3. Query for existing shows on the screen where:
   `status: 'SCHEDULED'`, `startsAt < newShowEndsAt`, and `endsAt > newShowStartsAt`.
   *(Where `newShowEndsAt = startsAt + durationMinutes + CLEANING_BUFFER_MINUTES`)*.
4. If an overlap is found: abort transaction and return `409 Conflict` with the overlapping show's timing details.
5. If clear: insert `Show` and bulk-insert `ShowSeat` documents within the same transaction.

### 2. Multi-Seat Hold Acquisition & Anti-Hoarding
1. Check customer's existing active holds for this show:
   `activeCount = ShowSeat.countDocuments({ show: showId, heldBy: userId, status: 'HELD', holdExpiresAt: { $gt: now } })`.
2. Assert `activeCount + requestedSeatIds.length <= MAX_SEATS_PER_BOOKING (8)`. If exceeded, reject with `422 Unprocessable Entity` ("Seat hold limit of 8 exceeded").
3. Inside a transaction, execute:
   ```ts
   const result = await ShowSeat.updateMany(
     {
       _id: { $in: seatIds },
       show: showId,
       $or: [
         { status: 'AVAILABLE' },
         { status: 'HELD', holdExpiresAt: { $lt: now } },
       ],
     },
     {
       $set: {
         status: 'HELD',
         heldBy: userId,
         holdExpiresAt: new Date(Date.now() + HOLD_MINUTES * 60 * 1000),
       },
     },
     { session }
   );
   ```
4. If `result.modifiedCount !== seatIds.length`: abort transaction and return `409 Conflict` with the conflicting seat IDs.
5. *Note*: Re-holding by the same user does **not** silently reset the expiry, preventing indefinite seat squatting.

### 3. Realistic Two-Phase Booking Flow & Payment Timeout
1. **Initiate Booking (`POST /api/v1/bookings/initiate`)**:
   - Verify all requested seats are currently `HELD` by `userId` and `holdExpiresAt > now`.
   - Extend hold by `PAYMENT_GRACE_PERIOD_MINUTES` (e.g. 2 minutes) to ensure user doesn't get timed out mid-checkout.
   - Create `Booking` in `PENDING_PAYMENT` status with `expiresAt`.
2. **Execute Simulated Payment (`POST /api/v1/bookings/:id/pay`)**:
   - **Crucial Rule**: Simulated payment gateway runs **outside** the database transaction (avoiding network stalls holding DB locks).
   - Record `Payment` record with status `INITIATED`.
   - Execute mock gateway call (`MOCK_SUCCESS`, `MOCK_FAIL`, `MOCK_TIMEOUT`).
3. **Confirm in Transaction (`POST /api/v1/bookings/:id/confirm`)**:
   - Start transaction.
   - Atomically transition seats:
     ```ts
     const seatResult = await ShowSeat.updateMany(
       {
         _id: { $in: booking.seats },
         status: 'HELD',
         heldBy: userId,
         holdExpiresAt: { $gt: now },
       },
       {
         $set: { status: 'BOOKED', booking: booking._id },
         $unset: { heldBy: '', holdExpiresAt: '' },
       },
       { session }
     );
     ```
   - **The "Paid But No Seat" Fallback**:
     - If `seatResult.modifiedCount !== booking.seats.length`:
       - The hold expired or was lost during payment execution.
       - Abort seat confirmation, update `Booking.status = 'EXPIRED'`, and set `Payment.refundStatus = 'REFUND_PENDING'`, `Payment.refundAmountInPaise = booking.totalAmountInPaise`.
       - Write a critical audit log record (`PAYMENT_CONFIRM_RACE_REFUND_TRIGGERED`).
       - Return `409 Conflict` explaining that seats were lost and a full automated refund has been initiated.
   - If all seats modified:
     - Update `Booking.status = 'CONFIRMED'`.
     - Update `Payment.status = 'SUCCESS'`.
     - Generate `Ticket` records with HMAC-signed QR tokens.
     - Commit transaction.

### 4. Admin Show Cancellation Cascade
When an admin cancels a scheduled show (`POST /api/v1/shows/:id/cancel`):
1. Start transaction.
2. Update `Show.status = 'CANCELLED'`.
3. Release all `ShowSeat` records for this show: `status = 'AVAILABLE'`, unset `booking`, `heldBy`, `holdExpiresAt`.
4. Find all `CONFIRMED` bookings for this show.
5. Update all bookings: `status = 'CANCELLED'`, `cancelledAt = now`, `cancelledBy = adminId`, `cancellationReason = 'SHOW_CANCELLED_BY_ADMIN'`.
6. Update all associated tickets: `status = 'CANCELLED'`.
7. Update associated payments: `refundStatus = 'REFUND_PENDING'`, `refundAmountInPaise = booking.totalAmountInPaise`.
8. Write audit logs for the cascade.
9. Commit transaction.

### 5. Staff Single-Use Ticket Validation Guard
When staff scans or submits a ticket (`POST /api/v1/tickets/validate`):
1. Verify signed HMAC/JWT token (check token integrity, extract `ticketId` and `showId`).
2. Verify show identity: the scanned ticket's `show` must match the staff terminal's active show.
3. Verify entry window: `now >= show.startsAt - 30 minutes` and `now <= show.endsAt`.
4. Execute single atomic state change:
   ```ts
   const ticket = await Ticket.findOneAndUpdate(
     {
       _id: ticketId,
       status: 'VALID',
     },
     {
       $set: {
         status: 'USED',
         validatedAt: new Date(),
         validatedBy: staffUserId,
       },
     },
     { new: true }
   );
   ```
5. If `ticket` is null: return `409 Conflict` or `422 Unprocessable` ("Ticket is already USED, CANCELLED, or INVALID"). Prevents duplicate admission.

