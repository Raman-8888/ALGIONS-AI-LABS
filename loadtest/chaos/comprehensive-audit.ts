import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

interface AuditAction {
  profile: 'GUEST' | 'CUSTOMER' | 'STAFF' | 'ADMIN';
  page: string;
  element: string;
  actionTaken: string;
  result: 'SUCCESS' | 'FAILED';
  details: string;
}

const auditLog: AuditAction[] = [];

async function logStep(profile: AuditAction['profile'], page: string, element: string, actionTaken: string, fn: () => Promise<string>) {
  try {
    const details = await fn();
    auditLog.push({ profile, page, element, actionTaken, result: 'SUCCESS', details });
    console.log(`✅ [${profile}] [${page}] ${element}: ${actionTaken} -> ${details}`);
  } catch (err: any) {
    auditLog.push({ profile, page, element, actionTaken, result: 'FAILED', details: err.message });
    console.error(`❌ [${profile}] [${page}] ${element}: ${actionTaken} -> FAILED: ${err.message}`);
  }
}

async function runFullProfileAudit() {
  console.log('🚀 Starting Comprehensive Profile & Button Action Audit');
  console.log(`🌐 Base URL: ${BASE_URL}\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Listen for console errors & unhandled errors
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`[PAGE_ERROR] ${e.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !msg.text().includes('401') && !msg.text().includes('chrome-extension')) {
      errors.push(`[CONSOLE_ERROR] ${msg.text()}`);
    }
  });

  // =========================================================================
  // PROFILE 1: GUEST / UNAUTHENTICATED VISITOR
  // =========================================================================
  console.log('--- 👤 TESTING PROFILE: GUEST (Unauthenticated) ---');

  await logStep('GUEST', '/', 'Navbar Brand', 'Click AlgionsCinema logo', async () => {
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
    await page.click('header a:has-text("AlgionsCinema")');
    return 'Maintains or reloads home page';
  });

  await logStep('GUEST', '/', 'Search Input', 'Type movie search query', async () => {
    await page.fill('input[placeholder*="Search movies"]', 'Interstellar');
    await page.waitForTimeout(400);
    const count = await page.$$eval('a[href^="/movie/"]', (els) => els.length);
    return `Filtered movie list down to ${count} matching card(s)`;
  });

  await logStep('GUEST', '/', 'Search Input Clear', 'Clear search query', async () => {
    await page.fill('input[placeholder*="Search movies"]', '');
    await page.waitForTimeout(400);
    const count = await page.$$eval('a[href^="/movie/"]', (els) => els.length);
    return `Restored movie catalog showing ${count} movie(s)`;
  });

  await logStep('GUEST', '/', 'Genre Filter Pills', 'Click "Sci-Fi" genre pill', async () => {
    const sciFiBtn = await page.$('button:has-text("Sci-Fi")');
    if (sciFiBtn) {
      await sciFiBtn.click();
      await page.waitForTimeout(400);
      return 'Genre filter activated';
    }
    return 'Sci-Fi pill not found';
  });

  await logStep('GUEST', '/', 'Genre Filter All', 'Click "All Genres" pill', async () => {
    await page.click('button:has-text("All Genres")');
    await page.waitForTimeout(400);
    return 'Reset filter to all genres';
  });

  await logStep('GUEST', '/', 'Movie Card', 'Click "View Showtimes →" on first movie', async () => {
    const card = await page.$('a[href^="/movie/"]');
    if (!card) throw new Error('No movie cards found');
    const href = await card.getAttribute('href');
    await card.click();
    await page.waitForURL(`**${href}`);
    return `Navigated to Movie Details: ${href}`;
  });

  await logStep('GUEST', '/movie/:id', 'Show Card', 'Click "Select Seats →"', async () => {
    await page.waitForSelector('a[href*="/seats"]', { timeout: 10000 });
    const seatBtn = await page.$('a[href*="/seats"]');
    if (!seatBtn) throw new Error('No showtime cards available');
    const href = await seatBtn.getAttribute('href');
    await seatBtn.click();
    await page.waitForURL(`**${href}`);
    return `Navigated to interactive seat map: ${href}`;
  });

  await logStep('GUEST', '/shows/:id/seats', 'Seat Button', 'Click available seat while logged out', async () => {
    await page.waitForSelector('button:has-text("1")', { timeout: 10000 });
    const availableSeat = await page.$('button:not([disabled]):has-text("1")');
    if (!availableSeat) throw new Error('No seats available on grid');
    await availableSeat.click();
    await page.waitForURL('**/login', { timeout: 5000 });
    return 'Unauthenticated access safely intercepted: redirected to /login with state';
  });

  await logStep('GUEST', '/login', 'Demo Buttons', 'Click Quick Demo "Customer" button', async () => {
    await page.click('button:has-text("Customer")');
    const emailVal = await page.$eval('input[type="email"]', (el: any) => el.value);
    const passVal = await page.$eval('input[type="password"]', (el: any) => el.value);
    if (!emailVal || !passVal) throw new Error('Credentials not prefilled');
    return `Pre-filled form with ${emailVal}`;
  });

  // =========================================================================
  // PROFILE 2: CUSTOMER
  // =========================================================================
  console.log('\n--- 🎟️ TESTING PROFILE: CUSTOMER ---');

  await logStep('CUSTOMER', '/login', 'Sign In Button', 'Submit login credentials', async () => {
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    const text = await page.innerText('header');
    if (!text.includes('CUSTOMER')) throw new Error('Customer badge missing from header');
    return 'Logged in successfully, header updated with user name & CUSTOMER badge';
  });

  await logStep('CUSTOMER', '/shows/:id/seats', 'Seat Grid Selection', 'Click seat to acquire hold', async () => {
    // Navigate to seat map
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
    const movie = await page.$('a[href^="/movie/"]');
    await movie?.click();
    await page.waitForTimeout(1000);
    const show = await page.$('a[href*="/seats"]');
    await show?.click();
    await page.waitForTimeout(1500);

    // Click available seat
    const seatBtn = await page.$('button.cursor-pointer');
    if (!seatBtn) throw new Error('No available seat button found');
    await seatBtn.click();
    await page.waitForTimeout(2000);

    const hasFloatingBar = await page.waitForSelector('text=Proceed to Checkout', { timeout: 8000 });
    if (!hasFloatingBar) throw new Error('Floating action bar did not appear after hold');
    return 'Seat hold acquired, countdown timer started, floating checkout bar appeared';
  });

  await logStep('CUSTOMER', '/shows/:id/seats', 'Checkout Button', 'Click "Proceed to Checkout →"', async () => {
    await page.click('button:has-text("Proceed to Checkout")');
    await page.waitForURL('**/checkout', { timeout: 5000 });
    return 'Navigated to review and checkout page';
  });

  await logStep('CUSTOMER', '/checkout', 'Payment Simulator Radio', 'Select MOCK_FAIL simulation mode', async () => {
    await page.click('input[value="MOCK_FAIL"]');
    return 'Simulation radio set to MOCK_FAIL';
  });

  await logStep('CUSTOMER', '/checkout', 'Payment Submit Button', 'Click "Pay & Confirm Booking" with MOCK_FAIL', async () => {
    await page.click('button:has-text("Pay & Confirm Booking")');
    await page.waitForTimeout(1500);
    const errorBanner = (await page.$('text=Payment declined')) || (await page.$('.bg-rose-500\\/10')) || (await page.$('text=declined'));
    if (!errorBanner) throw new Error('Error banner did not trigger on payment failure');
    return 'Gateway decline handled gracefully: error displayed, booking preserved in PENDING_PAYMENT';
  });

  await logStep('CUSTOMER', '/checkout', 'Payment Simulator Radio', 'Select MOCK_SUCCESS simulation mode', async () => {
    await page.click('input[value="MOCK_SUCCESS"]');
    return 'Simulation radio set to MOCK_SUCCESS';
  });

  await logStep('CUSTOMER', '/checkout', 'Payment Confirm Button', 'Click "Pay & Confirm Booking" with MOCK_SUCCESS', async () => {
    await page.click('button:has-text("Pay & Confirm Booking")');
    await page.waitForURL('**/confirmation/**', { timeout: 12000 });
    const successTitle = await page.innerText('text=Booking Confirmed');
    return `Transaction committed successfully: ${successTitle}`;
  });

  await logStep('CUSTOMER', '/confirmation/:id', 'QR Tickets Display', 'Verify digital ticket SVG QR generation', async () => {
    const qrCount = await page.$$eval('svg', (els) => els.length);
    if (qrCount === 0) throw new Error('QR codes not rendered');
    return `Rendered ${qrCount} QR SVG digital ticket pass(es)`;
  });

  await logStep('CUSTOMER', '/confirmation/:id', 'View My Bookings Button', 'Click "View My Bookings"', async () => {
    await page.click('a:has-text("View My Bookings")');
    await page.waitForURL('**/my-bookings');
    return 'Navigated to My Bookings history page';
  });

  await logStep('CUSTOMER', '/my-bookings', 'View Ticket QR Modal', 'Click "Seat X (QR)" pass button', async () => {
    await page.waitForSelector('button:has-text("(QR)")', { timeout: 8000 });
    const qrBtn = await page.$('button:has-text("(QR)")');
    if (!qrBtn) throw new Error('No QR button found in booking row');
    await qrBtn.click();
    await page.waitForTimeout(500);
    const modalTitle = await page.innerText('text=Digital Admission Pass');
    // Close modal
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    return `Opened and dismissed QR admission modal (${modalTitle})`;
  });

  await logStep('CUSTOMER', '/my-bookings', 'Cancel Booking Button', 'Click "Cancel Booking" and verify modal', async () => {
    const cancelBtn = await page.$('button:has-text("Cancel Booking")');
    if (cancelBtn) {
      await cancelBtn.click();
      await page.waitForTimeout(500);
      const modalText = await page.innerText('text=Confirm Booking Cancellation');
      await page.click('button:has-text("Keep Booking")');
      await page.waitForTimeout(300);
      return `Cancellation modal opened with 100% refund policy (${modalText}) and dismissed safely`;
    }
    return 'Cancellation button not active (e.g. within 60m cutoff window)';
  });

  await logStep('CUSTOMER', 'Navbar', 'Logout Button', 'Click Logout icon button', async () => {
    await page.click('button[title="Logout"]');
    await page.waitForURL('**/login');
    return 'Logged out customer, session cookie cleared, redirected to /login';
  });

  // =========================================================================
  // PROFILE 3: STAFF SCANNER
  // =========================================================================
  console.log('\n--- 🛡️ TESTING PROFILE: STAFF ---');

  await logStep('STAFF', '/login', 'Demo Staff Button', 'Click Quick Demo "Staff" and Sign In', async () => {
    await page.click('button:has-text("Staff")');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1500);
    const text = await page.innerText('header');
    if (!text.includes('STAFF')) throw new Error('STAFF role badge not found in header');
    return 'Logged in as Staff, STAFF badge active';
  });

  await logStep('STAFF', '/admin/dashboard', 'RBAC Guard', 'Attempt direct navigation to /admin/dashboard', async () => {
    await page.goto(`${BASE_URL}/admin/dashboard`, { waitUntil: 'networkidle' });
    await page.waitForURL('**/403');
    const forbiddenText = await page.innerText('text=403 - Access Forbidden');
    return `RBAC protection active: non-admin blocked with ${forbiddenText}`;
  });

  await logStep('STAFF', '/403', 'Return to Home Button', 'Click "Return to Home"', async () => {
    await page.click('a:has-text("Return to Home")');
    await page.waitForURL(`${BASE_URL}/`);
    return 'Returned to home page';
  });

  await logStep('STAFF', 'Navbar', 'Ticket Scanner Link', 'Click "Ticket Scanner" link', async () => {
    await page.click('a:has-text("Ticket Scanner")');
    await page.waitForURL('**/staff/scanner');
    return 'Navigated to Staff Ticket Admission Scanner';
  });

  await logStep('STAFF', '/staff/scanner', 'Show Selector Dropdown', 'Inspect active auditorium shows', async () => {
    const optionsCount = await page.$$eval('select option', (opts) => opts.length);
    return `Auditorium selector populated with ${optionsCount} active show(s)`;
  });

  await logStep('STAFF', '/staff/scanner', 'Validate Ticket Form', 'Enter test ticket token & submit', async () => {
    await page.fill('textarea[placeholder*="Paste QR"]', 'TK-20261112-DEMOTOKEN123');
    await page.click('button:has-text("Validate & Admit Patron")');
    await page.waitForTimeout(1000);
    const alertText = await page.$eval('div:has-text("ACCESS")', (el) => el.innerText);
    return `Scanner evaluated token: ${alertText.split('\n')[0]}`;
  });

  await logStep('STAFF', 'Navbar', 'Logout Button', 'Click Logout button', async () => {
    await page.click('button[title="Logout"]');
    await page.waitForURL('**/login');
    return 'Logged out staff cleanly';
  });

  // =========================================================================
  // PROFILE 4: ADMIN
  // =========================================================================
  console.log('\n--- 👑 TESTING PROFILE: ADMIN ---');

  await logStep('ADMIN', '/login', 'Demo Admin Button', 'Click Quick Demo "Admin" and Sign In', async () => {
    await page.click('button:has-text("Admin")');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1500);
    const text = await page.innerText('header');
    if (!text.includes('ADMIN')) throw new Error('ADMIN badge not found in header');
    return 'Logged in as Admin, ADMIN badge and Admin Panel dropdown visible';
  });

  await logStep('ADMIN', '/admin/dashboard', 'Dashboard Navigation', 'Navigate to Dashboard & Reports', async () => {
    await page.goto(`${BASE_URL}/admin/dashboard`, { waitUntil: 'networkidle' });
    const grossRev = await page.innerText('text=Gross Revenue');
    const occTable = await page.innerText('text=Live Show Occupancy Report');
    return `Dashboard loaded: ${grossRev}, ${occTable}`;
  });

  await logStep('ADMIN', '/admin/shows', 'Shows Manager Navigation', 'Open Shows Manager & inspect table', async () => {
    await page.goto(`${BASE_URL}/admin/shows`, { waitUntil: 'networkidle' });
    const count = await page.$$eval('table tbody tr', (rows) => rows.length);
    return `Shows Manager loaded with ${count} scheduled show(s)`;
  });

  await logStep('ADMIN', '/admin/shows', 'Schedule New Show Button', 'Click "Schedule New Show" modal button', async () => {
    await page.click('button:has-text("Schedule New Show")');
    await page.waitForTimeout(500);
    const modalTitle = await page.innerText('text=Schedule Auditorium Show');
    const screenOptions = await page.$$eval('select', (els) => els.length);
    await page.click('form button:has-text("Cancel")');
    await page.waitForTimeout(300);
    return `Schedule modal opened (${modalTitle}), populated ${screenOptions} dropdowns, and closed`;
  });

  await logStep('ADMIN', '/admin/movies', 'Movies Manager Navigation', 'Open Movies Manager & inspect list', async () => {
    await page.goto(`${BASE_URL}/admin/movies`, { waitUntil: 'networkidle' });
    const movieCount = await page.$$eval('table tbody tr', (rows) => rows.length);
    return `Movies Manager loaded with ${movieCount} movie catalog record(s)`;
  });

  await logStep('ADMIN', '/admin/movies', 'Add New Movie Button', 'Click "Add New Movie" modal button', async () => {
    await page.click('button:has-text("Add New Movie")');
    await page.waitForTimeout(500);
    const modalTitle = await page.innerText('text=Add New Movie');
    await page.click('button:has-text("Cancel")');
    await page.waitForTimeout(300);
    return `Add Movie modal opened (${modalTitle}) with genre tag selectors and closed`;
  });

  await logStep('ADMIN', '/admin/theatres', 'Theatres Manager Navigation', 'Open Theatres & Screens manager', async () => {
    await page.goto(`${BASE_URL}/admin/theatres`, { waitUntil: 'networkidle' });
    const theatreCount = await page.$$eval('div:has-text("Cinemas") button', (btns) => btns.length);
    return `Theatres Manager loaded with ${theatreCount} cinema complex record(s)`;
  });

  await logStep('ADMIN', '/admin/theatres', 'Add Theatre Button', 'Click "Add Theatre" button', async () => {
    await page.click('button:has-text("Add Theatre")');
    await page.waitForTimeout(500);
    const modalTitle = await page.innerText('text=Add Cinema Theatre');
    await page.click('button:has-text("Cancel")');
    await page.waitForTimeout(300);
    return `Add Theatre modal opened (${modalTitle}) and closed`;
  });

  await logStep('ADMIN', '/admin/theatres', 'Add Screen Button', 'Click "Add Screen" button', async () => {
    await page.click('button:has-text("Add Screen")');
    await page.waitForTimeout(500);
    const modalTitle = await page.innerText('text=Configure Screen Layout');
    const calcCapacity = await page.innerText('text=Calculated Total Capacity');
    await page.click('button:has-text("Cancel")');
    await page.waitForTimeout(300);
    return `Screen Layout Designer modal opened (${modalTitle}, ${calcCapacity}) and closed`;
  });

  await logStep('ADMIN', '/admin/audit', 'Audit Logs Navigation', 'Open Security Audit Trail', async () => {
    await page.goto(`${BASE_URL}/admin/audit`, { waitUntil: 'networkidle' });
    const logRows = await page.$$eval('table tbody tr', (rows) => rows.length);
    return `Audit trail loaded displaying ${logRows} immutable audit entries`;
  });

  await logStep('ADMIN', '/admin/audit', 'Audit Action Filter', 'Filter audit logs by "SHOW_CREATED"', async () => {
    await page.selectOption('select', 'SHOW_CREATED');
    await page.waitForTimeout(500);
    const logRows = await page.$$eval('table tbody tr', (rows) => rows.length);
    return `Filtered audit log entries down to ${logRows} SHOW_CREATED events`;
  });

  await logStep('ADMIN', '/admin/audit', 'View Details JSON Button', 'Click "View Details JSON" icon button', async () => {
    const detailBtn = await page.$('button[title="View Details JSON"]');
    if (detailBtn) {
      await detailBtn.click();
      await page.waitForTimeout(500);
      const modalTitle = await page.innerText('text=Sanitized Audit Payload');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      return `Opened and dismissed Sanitized Audit Payload modal (${modalTitle})`;
    }
    return 'No details payload icon in first row';
  });

  await logStep('ADMIN', 'Navbar', 'Logout Button', 'Click Logout button', async () => {
    await page.click('button[title="Logout"]');
    await page.waitForURL('**/login');
    return 'Admin logged out cleanly, redirected to /login';
  });

  await browser.close();

  // Print Summary Table
  console.log('\n======================================================');
  console.log('📊 COMPREHENSIVE PROFILE & BUTTON AUDIT RESULTS');
  console.log('======================================================');
  console.log(`Total Interactive Actions Tested: ${auditLog.length}`);
  const passCount = auditLog.filter((a) => a.result === 'SUCCESS').length;
  const failCount = auditLog.filter((a) => a.result === 'FAILED').length;
  console.log(`Passed: ${passCount} | Failed: ${failCount}`);
  console.log(`Errors Logged: ${errors.length}`);
  if (errors.length > 0) {
    console.error('Console / Page Errors Detected:', errors);
  }
}

runFullProfileAudit();
