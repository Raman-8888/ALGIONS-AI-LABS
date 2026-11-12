# Gremlins.js + Playwright Chaos & Monkey Testing Report

**Date of Execution:** 2026-11-13  
**Target Environment:** Full-Stack (React 19 Frontend on `localhost:5173` + Express TypeScript Backend on `localhost:5000`)  
**Methodology:** Automated In-Browser Chaos / Monkey Testing using **Gremlins.js** injected via **Playwright Chromium**.

---

## 1. Executive Summary

To stress-test frontend resilience, edge-case input handling, and unexpected UI race conditions, we paired **Playwright** with **Gremlins.js**. A horde of thousands of simulated chaotic users ("gremlins") attacked the application with rapid-fire clicks, arbitrary keystrokes, form-filling with edge-case characters, and viewport scrolling across all public, customer, staff, and administrative routes.

### Summary Metrics
| Metric | Value |
|---|---|
| **Total Routes Attacked** | 9 Core Application Routes |
| **Total Chaotic Actions Unleashed** | **5,600 Actions** |
| **React Component Crashes (`ErrorBoundary`)** | **0** |
| **Unhandled JavaScript Exceptions (`pageerror`)** | **0** |
| **HTTP 5xx Server Crashes** | **0** |
| **Defects Discovered & Remediated** | **1 Real Missing Endpoint (404)** |
| **Final Residual Critical Issues** | **0 (Clean Bill of Health)** |

---

## 2. Chaos Species & Test Configuration

```typescript
const horde = window.gremlins.createHorde({
  species: [
    window.gremlins.species.clicker({ clickTypes: ['click'], maxNbTries: 10 }),
    window.gremlins.species.formFiller(),
    window.gremlins.species.scroller(),
    window.gremlins.species.typer(),
  ],
  mogwais: [
    window.gremlins.mogwais.alert(),
    window.gremlins.mogwais.gizmo({ maxErrors: 100 }),
  ],
  strategies: [
    window.gremlins.strategies.distribution({ delay: 15, nb: count }),
  ],
});
```

- **Clicker**: Fires mouse click events rapidly on links, buttons, seat cells, modals, and backdrop overlays.
- **FormFiller**: Injects random text, special characters, whitespace, and boundary-length values into input fields, textareas, and select elements.
- **Scroller**: Executes erratic vertical and horizontal scroll jumps to test viewport-bound positioning and floating action bars.
- **Typer**: Emits rapid keyboard inputs to trigger keydown/keyup event handlers.

---

## 3. Route-by-Route Breakdown

| # | Route Tested | Actions | React Crashes | Unhandled Exceptions | Status |
|---|---|---|---|---|---|
| 1 | `/` (Browse Movies & Filters) | 800 | 0 | 0 | **PASS** |
| 2 | `/login` (Authentication Flow) | 600 | 0 | 0 | **PASS** |
| 3 | `/movie/:id` (Movie Details & Showtimes) | 600 | 0 | 0 | **PASS** |
| 4 | `/my-bookings` (Booking History & Tickets) | 600 | 0 | 0 | **PASS** |
| 5 | `/staff/scanner` (Ticket QR Scanner) | 600 | 0 | 0 | **PASS** |
| 6 | `/admin/dashboard` (Analytics & Reports) | 600 | 0 | 0 | **PASS** |
| 7 | `/admin/shows` (Show Scheduler) | 600 | 0 | 0 | **PASS** |
| 8 | `/admin/theatres` (Screen Geometry Manager) | 600 | 0 | 0 | **PASS** |
| 9 | `/admin/audit` (Append-Only Audit Trail) | 600 | 0 | 0 | **PASS** |

---

## 4. Defect Caught by Gremlins & Remediation

### 🐛 Defect: Missing `GET /api/v1/screens` Route
- **Detection**:
  During the barrage on `/admin/shows` and `/admin/theatres`, the gremlins triggered modal dropdowns that call `api.screens.list(theatreId)`.
  The browser console captured:
  ```
  Failed to load resource: the server responded with a status of 404 (Not Found)
  Cannot GET /api/v1/screens?theatreId=6af60a4790facc8693c168d4
  ```
- **Root Cause**:
  `screens.routes.ts` previously only implemented `GET /:id`, `POST /`, `PATCH /:id`, and `DELETE /:id`. The query-based list endpoint `GET /` was missing on the backend.
- **Remediation**:
  1. Added `ScreensService.listScreens(theatreId?: string)`.
  2. Added `ScreensController.list` to unwrap `theatreId` query parameter and return `{ data: { screens } }`.
  3. Mounted `screensRouter.get('/', ScreensController.list)`.
- **Verification**:
  Re-ran the 5,600-action gremlin barrage across all routes. The 404 completely vanished and screens loaded cleanly across all modals.

---

## 5. Resilience Highlights

1. **Zero ErrorBoundary Trips**:
   Even with 15ms delay click and typing barrages on interactive elements, React 19's virtual DOM never encountered an unhandled render exception.
2. **Defensive Form & Route Guards**:
   Random inputs into the ticket scanner and login forms were safely rejected by backend Zod validation (422 Unprocessable Entity) and handled cleanly by frontend error banners without crashing the application state.
3. **Modal Isolation**:
   Rapid clicking on backdrop overlays and "Escape" keyboard inputs properly opened and closed modals without leaving orphaned DOM backdrops or locking page scroll.

---

## 7. Comprehensive Profile & Button Action Audit

Following the chaotic testing, we executed a systematic, button-by-button automated audit across all 4 user personas (**Guest**, **Customer**, **Staff**, **Admin**) in `loadtest/chaos/comprehensive-audit.ts`.

### Full Results Matrix (41 / 41 Actions Passed - 100%)

| Profile | Page / View | UI Element | Action Performed | Verified Real Behavior | Status |
|---|---|---|---|---|---|
| **GUEST** | `/` | Navbar Brand | Click logo | Reloads/maintains catalog | **PASS** |
| **GUEST** | `/` | Search Bar | Type query | Filters catalog in real time | **PASS** |
| **GUEST** | `/` | Search Clear | Clear query | Restores full catalog | **PASS** |
| **GUEST** | `/` | Genre Filter | Click "Sci-Fi" pill | Activates category filter | **PASS** |
| **GUEST** | `/` | Genre Reset | Click "All Genres" pill | Resets genre filter | **PASS** |
| **GUEST** | `/` | Movie Card | Click "View Showtimes →" | Navigates to `/movie/:id` | **PASS** |
| **GUEST** | `/movie/:id` | Show Card | Click "Select Seats →" | Navigates to `/shows/:id/seats` | **PASS** |
| **GUEST** | `/shows/:id/seats` | Seat Grid | Click available seat | Redirects to `/login` with return state | **PASS** |
| **GUEST** | `/login` | Demo Buttons | Click "Customer" button | Pre-fills customer credentials | **PASS** |
| **CUSTOMER** | `/login` | Submit Form | Click "Sign In" | Authenticates & updates header badge | **PASS** |
| **CUSTOMER** | `/shows/:id/seats` | Seat Cell | Click available seat | Acquires 5-min hold, starts countdown, shows floating bar | **PASS** |
| **CUSTOMER** | `/shows/:id/seats` | Action Bar | Click "Proceed to Checkout →" | Navigates to `/checkout` | **PASS** |
| **CUSTOMER** | `/checkout` | Gateway Radio | Select `MOCK_FAIL` | Toggles simulator option | **PASS** |
| **CUSTOMER** | `/checkout` | Payment Button | Click "Pay & Confirm Booking" | Gateway decline handled, error banner shown, hold preserved | **PASS** |
| **CUSTOMER** | `/checkout` | Gateway Radio | Select `MOCK_SUCCESS` | Toggles simulator option | **PASS** |
| **CUSTOMER** | `/checkout` | Payment Button | Click "Pay & Confirm Booking" | ACID transaction committed, navigates to confirmation | **PASS** |
| **CUSTOMER** | `/confirmation/:id` | QR Pass Container | Verify digital ticket passes | Generates signed SVG QR code tokens | **PASS** |
| **CUSTOMER** | `/confirmation/:id` | Action Button | Click "View My Bookings" | Navigates to `/my-bookings` | **PASS** |
| **CUSTOMER** | `/my-bookings` | Pass Button | Click "Seat A1 (QR)" | Opens digital ticket admission modal | **PASS** |
| **CUSTOMER** | `/my-bookings` | Cancellation Button | Click "Cancel Booking" | Opens modal with 100% refund policy & dismisses cleanly | **PASS** |
| **CUSTOMER** | Navbar | Logout Button | Click Logout icon | Clears session cookie, redirects to `/login` | **PASS** |
| **STAFF** | `/login` | Demo Buttons | Click "Staff" & submit | Authenticates with `STAFF` header badge | **PASS** |
| **STAFF** | `/admin/dashboard` | RBAC Guard | Direct URL navigation | Blocked by role guard with `403 - Access Forbidden` | **PASS** |
| **STAFF** | `/403` | Return Button | Click "Return to Home" | Navigates back to public portal | **PASS** |
| **STAFF** | Navbar | Nav Link | Click "Ticket Scanner" | Navigates to `/staff/scanner` | **PASS** |
| **STAFF** | `/staff/scanner` | Select Dropdown | Inspect auditorium shows | Lists scheduled shows | **PASS** |
| **STAFF** | `/staff/scanner` | Validation Form | Enter QR token & submit | Evaluates token and single-use validation state | **PASS** |
| **STAFF** | Navbar | Logout Button | Click Logout button | Clears staff session cleanly | **PASS** |
| **ADMIN** | `/login` | Demo Buttons | Click "Admin" & submit | Authenticates with `ADMIN` badge & admin dropdown | **PASS** |
| **ADMIN** | `/admin/dashboard` | Nav Link | Open Dashboard & Reports | Loads Gross Revenue metrics and Live Show Occupancy report | **PASS** |
| **ADMIN** | `/admin/shows` | Nav Link | Open Shows Manager | Loads scheduled shows table | **PASS** |
| **ADMIN** | `/admin/shows` | Action Button | Click "Schedule New Show" | Opens modal with movie/theatre/screen dropdowns & closes | **PASS** |
| **ADMIN** | `/admin/movies` | Nav Link | Open Movies Manager | Loads movie catalog | **PASS** |
| **ADMIN** | `/admin/movies` | Action Button | Click "Add New Movie" | Opens modal with genre tags & duration fields & closes | **PASS** |
| **ADMIN** | `/admin/theatres` | Nav Link | Open Theatres Manager | Loads cinema complexes & screen list | **PASS** |
| **ADMIN** | `/admin/theatres` | Action Button | Click "Add Theatre" | Opens modal with name, city, timezone fields & closes | **PASS** |
| **ADMIN** | `/admin/theatres` | Action Button | Click "Add Screen" | Opens interactive Screen Layout Designer (seat capacity calculator) | **PASS** |
| **ADMIN** | `/admin/audit` | Nav Link | Open Audit Logs | Loads append-only immutable audit trail | **PASS** |
| **ADMIN** | `/admin/audit` | Filter Dropdown | Filter by action type | Filters events dynamically | **PASS** |
| **ADMIN** | `/admin/audit` | Action Button | Click "View Details JSON" | Inspects audit event metadata | **PASS** |
| **ADMIN** | Navbar | Logout Button | Click Logout button | Clears admin session cleanly | **PASS** |


```bash
# Ensure server and client are running
npm run dev

# Run Gremlins.js chaos runner with Playwright
npx tsx loadtest/chaos/gremlins-runner.ts
```
The runner will output live console alerts and generate a structured JSON telemetry report in `loadtest/chaos/chaos-report.json`.

