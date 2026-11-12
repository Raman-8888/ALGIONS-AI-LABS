# Algions Cinema Hall Ticket Booking Engine — Demo Video Script

**Target Duration:** 5–7 Minutes  
**Presenter Tone:** Clear, authoritative, senior-level engineering walkthrough focusing on concurrency, transaction isolation, and acceptance test verification.

---

## 🎬 Section 1: Introduction & Architecture Overview (1:00)

**[Visual: Show architecture diagram in `docs/architecture-reference.md` or Swagger UI at `/api/docs`]**

> *"Hello, my name is Raman, and this is the Cinema Hall Ticket Booking Engine built for the Algions AI Labs internship assessment.*
>
> *Cinema booking systems present a classic distributed systems challenge: under blockbuster traffic bursts, hundreds of users race to claim the same prime seats simultaneously.*
>
> *Our system is architected in TypeScript and Node.js with MongoDB multi-document ACID transactions. We use independent per-seat documents with compound unique indexes to maximize parallel write throughput without document-level bottlenecks. Overlapping show creation is serialized via atomic `Screen.scheduleVersion` locking, and payment processing is decoupled outside database transactions to eliminate connection pool starvation.*
>
> *Let's now demonstrate the 5 core acceptance tests in action."*

---

## 🎬 Section 2: Acceptance Test 1 — Concurrent Seat Race Condition (1:30)

**[Visual: Open two browser windows side-by-side: Window A logged in as Customer 1, Window B logged in as Customer 2. Both navigating to `/shows/:id/seats` for the same show.]**

> *"In Acceptance Test 1, we test concurrent contention. Both users view the same auditorium seat map in real-time.*
>
> *Watch seat **B4**:*
> - *Customer 1 clicks seat B4.*
> - *Simultaneously, Customer 2 clicks seat B4.*
>
> *Notice what happens:*
> - *Customer 1's request commits in MongoDB with an atomic conditional update. Seat B4 turns blue with a 5-minute countdown timer.*
> - *Customer 2's request immediately encounters a 409 Conflict. The UI displays our clear toast: 'Seat just taken by another customer! Please choose another seat.'*
> - *On Customer 2's screen, seat B4 instantly updates to orange (Held by others).*
>
> *No duplicate holds, zero double-booking."*

---

## 🎬 Section 3: Acceptance Test 2 — Dual Expiry & Seat Release (1:00)

**[Visual: Customer 1 holds seat B4 and leaves it alone. Observe CountdownTimer.]**

> *"In Acceptance Test 2, we demonstrate our dual-expiry architecture.*
>
> *Customer 1 is holding seat B4 with a 5-minute hold timer. What happens if they abandon their checkout?*
>
> *We have two layers of protection:*
> 1. *Our background `HoldSweeper` worker sweeps expired holds every 30 seconds and logs system audit trails.*
> 2. *More importantly, on the read path, our API dynamically evaluates `holdExpiresAt < now` as `AVAILABLE` with microsecond CPU speed.*
>
> *When the countdown expires, seat B4 automatically flips back to green (Available). Customer 2 can now click and claim it immediately without any manual administrative intervention."*

---

## 🎬 Section 4: Acceptance Test 3 — Idempotent Two-Phase Checkout & Gateway Retry (1:30)

**[Visual: Navigate to `/checkout` with 2 selected seats. Show payment simulation options.]**

> *"Now let's proceed to checkout. Notice how we isolate payment gateway execution outside the database transaction.*
>
> *First, we simulate `MOCK_FAIL` (card decline):*
> - *The payment fails, but the booking remains safely in `PENDING_PAYMENT` state.*
> - *The customer clicks 'Retry Payment' without losing their seats.*
>
> *Now, we select `MOCK_SUCCESS` and submit.*
> - *The checkout uses a cryptographic `Idempotency-Key` header with `status: IN_PROGRESS` reservation.*
> - *If a network disconnect occurs and the client retries, the server recognizes the identical SHA-256 payload hash and immediately replays the cached 200 response without creating duplicate bookings or double-charging.*
>
> *And if a customer's hold expires while third-party payment is in progress? Our 'Paid but no seat' fallback rule immediately commits `Booking = EXPIRED` and sets `refundStatus = REFUND_PENDING` with an automated 100% refund."*

---

## 🎬 Section 5: Acceptance Test 4 — Single-Use Ticket Admission & Double-Scan Prevention (1:00)

**[Visual: Open Confirmation page showing HMAC QR code. In a second window, open `/staff/scanner` logged in as Staff.]**

> *"Upon booking confirmation, the customer receives digital tickets with HMAC-signed QR tokens.*
>
> *At the auditorium door, the usher uses our Staff Ticket Scanner:*
> - *Staff scans the QR token.*
> - *The atomic query `Ticket.findOneAndUpdate({ _id, status: 'VALID' }, { status: 'USED' })` executes.*
> - *Screen shows big green banner: **ADMISSION GRANTED — Seat B4**.*
>
> *Now, what if the patron attempts to share a screenshot of the QR code with a friend?*
> - *Staff scans the exact same ticket a second time.*
> - *The system rejects it instantly with HTTP 409 Conflict: **DOUBLE SCAN REJECTED: Ticket was already validated at [timestamp]**.*
>
> *Door timing windows (30m prior to showtime) and show ID matching are strictly enforced."*

---

## 🎬 Section 6: Acceptance Test 5 — Occupancy Report & Cancellation (1:00)

**[Visual: Navigate to Admin Dashboard at `/admin/dashboard`. Then open Customer's `/my-bookings`.]**

> *"Finally, let's verify Acceptance Test 5:*
>
> *On the Admin Dashboard, our Occupancy Report calculates live capacity:*
> $$\text{Occupancy} = \text{Confirmed Bookings} - \text{Cancellations}$$
>
> *Our show currently displays 2 booked seats with positive net revenue.*
>
> *Now, the customer navigates to 'My Bookings':*
> - *Since showtime is > 60 minutes away, the 'Cancel Booking' button is enabled.*
> - *Customer confirms cancellation.*
> - *In one ACID transaction: booking is marked `CANCELLED`, seats are returned to `AVAILABLE`, tickets are invalidated, and a 100% refund is initiated.*
>
> *Returning to the Admin Dashboard: the occupancy count immediately decrements back to 0, gross vs. refund reconciliation balances to the exact rupee, and an immutable record appears in our append-only Audit Trail at `/admin/audit`."*

---

## 🎬 Section 7: Conclusion (0:30)

> *"In summary, the system satisfies all 5 acceptance tests with 59 passing automated tests, zero float errors, robust concurrency controls, and a clean, production-ready full-stack implementation.*
>
> *Thank you for your time and review."*

