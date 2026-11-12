import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const GREMLINS_PATH = path.resolve(__dirname, '../../node_modules/gremlins.js/dist/gremlins.min.js');

interface GremlinIssue {
  type: 'PAGE_ERROR' | 'CONSOLE_ERROR' | 'HTTP_5XX' | 'REACT_CRASH' | 'REQUEST_FAILED';
  route: string;
  message: string;
  details?: any;
  timestamp: string;
}

const collectedIssues: GremlinIssue[] = [];
const routeReports: any[] = [];

async function unleashHorde(page: any, routeName: string, actionsCount = 600) {
  console.log(`\n👾 [Gremlins] Unleashing horde on route: ${routeName} (${actionsCount} actions)...`);

  // Inject gremlins library
  await page.addScriptTag({ path: GREMLINS_PATH });

  // Evaluate gremlins attack
  const attackResult = await page.evaluate(async (count: number) => {
    return new Promise((resolve) => {
      // @ts-ignore
      if (typeof window.gremlins === 'undefined') {
        resolve({ error: 'gremlins.js not loaded on page' });
        return;
      }

      const logs: string[] = [];
      // @ts-ignore
      const horde = window.gremlins.createHorde({
        species: [
          // @ts-ignore
          window.gremlins.species.clicker({
            clickTypes: ['click'],
            maxNbTries: 10,
          }),
          // @ts-ignore
          window.gremlins.species.formFiller(),
          // @ts-ignore
          window.gremlins.species.scroller(),
          // @ts-ignore
          window.gremlins.species.typer(),
        ],
        mogwais: [
          // @ts-ignore
          window.gremlins.mogwais.alert(),
          // @ts-ignore
          window.gremlins.mogwais.gizmo({ maxErrors: 100 }),
        ],
        strategies: [
          // @ts-ignore
          window.gremlins.strategies.distribution({
            delay: 15, // Fast-paced barrage
            nb: count,
          }),
        ],
      });

      horde.unleash()
        .then(() => resolve({ success: true, count }))
        .catch((err: any) => resolve({ error: String(err) }));
    });
  }, actionsCount);

  // Give React and DOM 1.5s to settle
  await page.waitForTimeout(1500);

  // Check if React crashed
  const hasReactCrash = await page.evaluate(() => {
    const text = document.body.innerText || '';
    return text.includes('An error occurred') || text.includes('ErrorBoundary') || text.includes('Uncaught TypeError');
  });

  if (hasReactCrash) {
    collectedIssues.push({
      type: 'REACT_CRASH',
      route: routeName,
      message: 'React Error Boundary or unhandled component crash detected in DOM',
      timestamp: new Date().toISOString(),
    });
  }

  routeReports.push({
    route: routeName,
    actionsTriggered: actionsCount,
    attackResult,
    hasReactCrash,
  });
}

async function runChaosTestSuite() {
  console.log('🚀 Starting Playwright + Gremlins.js Chaos Testing on Algions Cinema Booking App');
  console.log(`🌐 Base URL: ${BASE_URL}`);

  const browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });

  const page = await context.newPage();

  // Telemetry listeners
  page.on('pageerror', (exception) => {
    console.error(`💥 [PAGE_ERROR] [${page.url()}]: ${exception.message}`);
    collectedIssues.push({
      type: 'PAGE_ERROR',
      route: page.url(),
      message: exception.message,
      details: exception.stack,
      timestamp: new Date().toISOString(),
    });
  });

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Filter out known chrome-extension or react-devtools noise
      if (text.includes('chrome-extension') || text.includes('unsafe-eval') || text.includes('Failed to load resource: the server responded with a status of 401')) {
        return;
      }
      console.warn(`⚠️ [CONSOLE_ERROR] [${page.url()}]: ${text}`);
      collectedIssues.push({
        type: 'CONSOLE_ERROR',
        route: page.url(),
        message: text,
        timestamp: new Date().toISOString(),
      });
    }
  });

  page.on('requestfailed', (request) => {
    // Ignore aborted pre-fetches
    if (request.failure()?.errorText === 'net::ERR_ABORTED') return;
    console.warn(`🔴 [REQUEST_FAILED]: ${request.url()} -> ${request.failure()?.errorText}`);
    collectedIssues.push({
      type: 'REQUEST_FAILED',
      route: page.url(),
      message: `${request.method()} ${request.url()} failed: ${request.failure()?.errorText}`,
      timestamp: new Date().toISOString(),
    });
  });

  page.on('response', (response) => {
    if (response.status() >= 500) {
      console.error(`🔥 [HTTP_5XX]: ${response.url()} -> Status ${response.status()}`);
      collectedIssues.push({
        type: 'HTTP_5XX',
        route: page.url(),
        message: `${response.request().method()} ${response.url()} returned HTTP ${response.status()}`,
        timestamp: new Date().toISOString(),
      });
    }
  });

  try {
    // ----------------------------------------------------
    // Scenario 1: Public Movie Browse Page
    // ----------------------------------------------------
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
    await unleashHorde(page, '/ (Browse Movies)', 800);

    // ----------------------------------------------------
    // Scenario 2: Login & Authentication Page
    // ----------------------------------------------------
    try {
      await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
      await unleashHorde(page, '/login (Auth Flow)', 600);
    } catch (e: any) {
      console.warn('Scenario 2 non-fatal notice:', e.message);
    }

    // Perform authenticated login as Admin to unlock all features
    console.log('\n🔑 Logging in as Admin to test authenticated & privileged pages...');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', 'admin@cinema.com');
    await page.fill('input[type="password"]', 'Password@123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);

    // ----------------------------------------------------
    // Scenario 3: Movie Details & Showtime Selection
    // ----------------------------------------------------
    try {
      await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
      const firstMovieLink = await page.$('a[href^="/movie/"]');
      if (firstMovieLink) {
        const movieHref = await firstMovieLink.getAttribute('href');
        await page.goto(`${BASE_URL}${movieHref}`, { waitUntil: 'networkidle' });
        await unleashHorde(page, `${movieHref} (Movie Details)`, 600);
      }
    } catch (e: any) {
      console.warn('Scenario 3 non-fatal notice:', e.message);
    }

    // ----------------------------------------------------
    // Scenario 4: Live Seat Map Contention & Rapid Clicks
    // ----------------------------------------------------
    try {
      const showLink = await page.$('a[href*="/seats"]');
      if (showLink) {
        const showHref = await showLink.getAttribute('href');
        await page.goto(`${BASE_URL}${showHref}`, { waitUntil: 'networkidle' });
        // Barrage the seat grid with 1,000 violent click/touch events
        await unleashHorde(page, `${showHref} (Interactive Seat Map)`, 1000);
      }
    } catch (e: any) {
      console.warn('Scenario 4 non-fatal notice:', e.message);
    }

    // ----------------------------------------------------
    // Scenario 5: Customer My Bookings
    // ----------------------------------------------------
    try {
      await page.goto(`${BASE_URL}/my-bookings`, { waitUntil: 'networkidle' });
      await unleashHorde(page, '/my-bookings (Booking History & Tickets)', 600);
    } catch (e: any) {
      console.warn('Scenario 5 non-fatal notice:', e.message);
    }

    // ----------------------------------------------------
    // Scenario 6: Staff Scanner Tool
    // ----------------------------------------------------
    try {
      await page.goto(`${BASE_URL}/staff/scanner`, { waitUntil: 'networkidle' });
      await unleashHorde(page, '/staff/scanner (Ticket QR Scanner)', 600);
    } catch (e: any) {
      console.warn('Scenario 6 non-fatal notice:', e.message);
    }

    // ----------------------------------------------------
    // Scenario 7: Admin Panel (Dashboard & Reports)
    // ----------------------------------------------------
    try {
      await page.goto(`${BASE_URL}/admin/dashboard`, { waitUntil: 'networkidle' });
      await unleashHorde(page, '/admin/dashboard (Occupancy & Sales)', 600);
    } catch (e: any) {
      console.warn('Scenario 7 non-fatal notice:', e.message);
    }

    // ----------------------------------------------------
    // Scenario 8: Admin Shows Manager
    // ----------------------------------------------------
    try {
      await page.goto(`${BASE_URL}/admin/shows`, { waitUntil: 'networkidle' });
      await unleashHorde(page, '/admin/shows (Shows Scheduler)', 600);
    } catch (e: any) {
      console.warn('Scenario 8 non-fatal notice:', e.message);
    }

    // ----------------------------------------------------
    // Scenario 9: Admin Theatres & Screen Geometry
    // ----------------------------------------------------
    try {
      await page.goto(`${BASE_URL}/admin/theatres`, { waitUntil: 'networkidle' });
      await unleashHorde(page, '/admin/theatres (Multiplex Layouts)', 600);
    } catch (e: any) {
      console.warn('Scenario 9 non-fatal notice:', e.message);
    }

    // ----------------------------------------------------
    // Scenario 10: Admin Audit Logs
    // ----------------------------------------------------
    try {
      await page.goto(`${BASE_URL}/admin/audit`, { waitUntil: 'networkidle' });
      await unleashHorde(page, '/admin/audit (Security Audit Trail)', 600);
    } catch (e: any) {
      console.warn('Scenario 10 non-fatal notice:', e.message);
    }

  } catch (err) {
    console.error('Fatal error during chaos execution:', err);
  } finally {
    await browser.close();
  }

  // Generate Report
  console.log('\n📊 Aggregating Chaos Test Results...');
  const reportPath = path.resolve(__dirname, 'chaos-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    executionTime: new Date().toISOString(),
    baseUrl: BASE_URL,
    totalRoutesTested: routeReports.length,
    totalIssuesFound: collectedIssues.length,
    routeReports,
    issues: collectedIssues,
  }, null, 2));

  console.log(`✅ Detailed JSON Report written to: ${reportPath}`);
}

runChaosTestSuite();

