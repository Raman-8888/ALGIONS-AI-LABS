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

## 6. How to Re-Run the Chaos Suite

```bash
# Ensure server and client are running
npm run dev

# Run Gremlins.js chaos runner with Playwright
npx tsx loadtest/chaos/gremlins-runner.ts
```
The runner will output live console alerts and generate a structured JSON telemetry report in `loadtest/chaos/chaos-report.json`.
