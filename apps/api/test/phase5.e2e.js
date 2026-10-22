/**
 * Phase 5 E2E Verification Suite (Quality & Deployment)
 * Covers all test cases in docs/E2E_TEST_PLAN.md for Phase 5:
 *   - Task 5.1 Responsive Design Testing: RESP-01 .. RESP-05
 *   - Task 5.2 Security & Validation:     SEC-01 .. SEC-03
 *   - Task 5.3 Docker Compose Setup:      DOCKER-01 .. DOCKER-05
 *   - Task 5.4 Final E2E Testing:         E2E-01 .. E2E-06
 *   - Task 5.5 Horizontal Scaling Prep:   SCALE-01 .. SCALE-02
 *
 * Run with both API (3001) and Web (3000) servers up:
 *   node apps/api/test/phase5.e2e.js
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

function loadPlaywright() {
  try {
    return require('playwright');
  } catch {
    const fallbackPath =
      '/Users/iannwendy/.npm/_npx/31e32ef8478fbf80/node_modules/playwright';
    return require(fallbackPath);
  }
}

const { chromium } = loadPlaywright();

const API = process.env.API_URL || 'http://localhost:3001';
const CLIENT = process.env.CLIENT_URL || 'http://localhost:3000';
const ROOT_DIR = path.resolve(__dirname, '../../..');

const results = [];

function record(id, name, ok, detail) {
  results.push({ id, name, ok, detail });
  const mark = ok ? 'PASS' : 'FAIL';
  console.log(`${mark}  ${id}  ${name}${detail ? `  — ${detail}` : ''}`);
}

async function test(id, name, fn) {
  try {
    const detail = await fn();
    record(id, name, true, typeof detail === 'string' ? detail : undefined);
  } catch (error) {
    record(id, name, false, error.message);
  }
}

async function apiCall(endpoint, { method = 'GET', body, token, cookie, headers = {} } = {}) {
  const h = { ...headers };
  if (body !== undefined) h['Content-Type'] = 'application/json';
  if (token) h.Authorization = `Bearer ${token}`;
  if (cookie) h.Cookie = cookie;

  const res = await fetch(`${API}${endpoint}`, {
    method,
    headers: h,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  const setCookies = res.headers.getSetCookie?.() || [];
  return { status: res.status, body: parsed, headers: res.headers, setCookies };
}

function extractCookie(setCookies, name) {
  const match = (setCookies || []).find((c) => c.startsWith(`${name}=`));
  return match ? match.split(';')[0] : null;
}

async function waitForUrlOk(url, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return res;
    } catch {
      // Wait and retry
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Timed out waiting for ${url} to become healthy`);
}

async function launchBrowser() {
  try {
    return await chromium.launch({ headless: true, channel: 'chrome' });
  } catch {
    return await chromium.launch({ headless: true });
  }
}

async function main() {
  console.log('\n=== PHASE 5: Quality & Deployment Full E2E Test Suite ===\n');

  // ===========================================================================
  // TASK 5.3: Docker Compose Setup (DOCKER-01 .. DOCKER-05)
  // ===========================================================================
  console.log('--- Task 5.3: Docker Compose Setup (DOCKER-01 .. DOCKER-05) ---');

  await test('DOCKER-01', 'Compose up: All 4 services (web, api, db, redis) running', async () => {
    const out = execSync('docker compose ps --format json', {
      cwd: ROOT_DIR,
      encoding: 'utf8',
    }).trim();
    const lines = out
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => JSON.parse(l));
    const runningServices = lines
      .filter((c) => c.State === 'running')
      .map((c) => c.Service)
      .sort();
    for (const expected of ['api', 'db', 'redis', 'web']) {
      assert.ok(
        runningServices.includes(expected),
        `Expected service "${expected}" to be running, found: ${runningServices.join(', ')}`
      );
    }
    return `4/4 services running (${runningServices.join(', ')})`;
  });

  await test('DOCKER-02', 'Frontend accessible: Visit http://localhost:3000 loads page', async () => {
    const res = await fetch(CLIENT);
    assert.equal(res.status, 200, `Expected 200 from ${CLIENT}, got ${res.status}`);
    const html = await res.text();
    assert.match(html, /aevo/i, 'Expected AEVO storefront HTML');
    return `GET ${CLIENT} -> 200 OK (${html.length} bytes)`;
  });

  await test('DOCKER-03', 'API accessible: Visit http://localhost:3001/health returns ok', async () => {
    const res = await apiCall('/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
    return `GET ${API}/health -> status=${res.body.status}, instanceId=${res.body.instanceId}`;
  });

  await test('DOCKER-04', 'Database connected: API health & container logs confirm PostgreSQL connection', async () => {
    const res = await apiCall('/health');
    assert.equal(res.body.database, 'connected');
    const logs = execSync('docker compose logs api', {
      cwd: ROOT_DIR,
      encoding: 'utf8',
    });
    assert.match(
      logs,
      /Connected to postgres|Existing products in database|AEVO API server running/i,
      'Expected PostgreSQL connection confirmation in API logs'
    );
    return `Database=${res.body.database}, Redis=${res.body.redis?.status}`;
  });

  await test('DOCKER-05', 'Compose down & recovery: `docker compose down` stops all containers cleanly', async () => {
    execSync('docker compose down', { cwd: ROOT_DIR, stdio: 'pipe' });
    const afterDown = execSync('docker compose ps -q', {
      cwd: ROOT_DIR,
      encoding: 'utf8',
    }).trim();
    assert.equal(afterDown, '', 'Expected 0 running containers after `docker compose down`');

    // Bring stack back up immediately so subsequent E2E tests execute against the live stack
    execSync('docker compose up -d', { cwd: ROOT_DIR, stdio: 'pipe' });
    await waitForUrlOk(`${API}/health`, 30000);
    await waitForUrlOk(CLIENT, 30000);
    return 'Verified `docker compose down` (0 containers) and restored `docker compose up -d`';
  });

  // ===========================================================================
  // TASK 5.1: Responsive Design Testing (RESP-01 .. RESP-05)
  // ===========================================================================
  console.log('\n--- Task 5.1: Responsive Design Testing (RESP-01 .. RESP-05) ---');

  const browser = await launchBrowser();
  try {
    const context = await browser.newContext({
      viewport: { width: 1200, height: 800 },
      locale: 'en-US',
    });
    const page = await context.newPage();

    await test('RESP-01', 'Desktop product grid (1200px): 3-4 columns & full layout', async () => {
      await page.setViewportSize({ width: 1200, height: 800 });
      await page.goto(`${CLIENT}/`, { waitUntil: 'networkidle' });
      const homeCols = await page.evaluate(() => {
        const grid = document.querySelector('[data-testid="new-arrivals-grid"]');
        return getComputedStyle(grid).gridTemplateColumns.split(' ').length;
      });
      assert.ok(homeCols >= 3 && homeCols <= 4, `Expected 3-4 columns on Home desktop, got ${homeCols}`);

      await page.goto(`${CLIENT}/products`, { waitUntil: 'networkidle' });
      const catalogCols = await page.evaluate(() => {
        const grid = document.querySelector('[data-testid="catalog-products-grid"]');
        return getComputedStyle(grid).gridTemplateColumns.split(' ').length;
      });
      assert.equal(catalogCols, 3, `Expected 3 columns on Catalog desktop, got ${catalogCols}`);
      return `Desktop (1200px): Home=${homeCols} cols, Catalog=${catalogCols} cols`;
    });

    await test('RESP-02', 'Tablet product grid (900px): 2-3 columns & adjusted layout', async () => {
      await page.setViewportSize({ width: 900, height: 800 });
      await page.goto(`${CLIENT}/products`, { waitUntil: 'networkidle' });
      const cols = await page.evaluate(() => {
        const grid = document.querySelector('[data-testid="catalog-products-grid"]');
        return getComputedStyle(grid).gridTemplateColumns.split(' ').length;
      });
      assert.ok(cols >= 2 && cols <= 3, `Expected 2-3 columns at 900px, got ${cols}`);
      return `Tablet (900px): Catalog=${cols} cols`;
    });

    await test('RESP-03', 'Mobile product grid (375px): 1-2 columns & stacked layout across pages', async () => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(`${CLIENT}/products`, { waitUntil: 'networkidle' });
      const mobileInfo = await page.evaluate(() => {
        const grid = document.querySelector('[data-testid="catalog-products-grid"]');
        const cols = getComputedStyle(grid).gridTemplateColumns.split(' ').length;
        const overflow = document.documentElement.scrollWidth > window.innerWidth;
        return { cols, overflow };
      });
      assert.ok(mobileInfo.cols >= 1 && mobileInfo.cols <= 2, `Expected 1-2 cols on mobile, got ${mobileInfo.cols}`);
      assert.equal(mobileInfo.overflow, false, 'Expected 0 horizontal overflow at 375px');
      return `Mobile (375px): Catalog=${mobileInfo.cols} col, overflow=false`;
    });

    await test('RESP-04', 'Mobile menu: Clicking mobile menu toggle opens navigation drawer', async () => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(`${CLIENT}/`, { waitUntil: 'networkidle' });
      const toggle = page.locator('[data-testid="mobile-menu-toggle"]');
      assert.equal(await toggle.isVisible(), true);
      await toggle.click();
      const drawer = page.locator('[data-testid="mobile-menu-drawer"]');
      assert.equal(await drawer.isVisible(), true, 'Mobile menu drawer must open');
      await page.keyboard.press('Escape');
      assert.equal(await drawer.isVisible(), false, 'Mobile menu drawer must close on Escape');
      return 'Mobile menu drawer open & close verified';
    });

    await test('RESP-05', 'Mobile filters: Clicking mobile filter button opens filter drawer', async () => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(`${CLIENT}/products`, { waitUntil: 'networkidle' });
      const filterTrigger = page.locator('[data-testid="mobile-filter-trigger"]');
      assert.equal(await filterTrigger.isVisible(), true);
      await filterTrigger.click();
      const filterDrawer = page.locator('[data-testid="mobile-filter-drawer"]');
      assert.equal(await filterDrawer.isVisible(), true, 'Mobile filter drawer must open');
      return 'Mobile filter drawer open verified at 375px';
    });
  } finally {
    await browser.close();
  }

  // ===========================================================================
  // TASK 5.2: Security & Validation (SEC-01 .. SEC-03)
  // ===========================================================================
  console.log('\n--- Task 5.2: Security & Validation (SEC-01 .. SEC-03) ---');

  const custLogin = await apiCall('/api/auth/login', {
    method: 'POST',
    body: { email: 'customer@aevo.com', password: 'customer123' },
  });
  assert.equal(custLogin.status, 200);
  const custToken = custLogin.body.token;
  const custCookie = extractCookie(custLogin.setCookies, 'token');

  await test('SEC-01', 'Admin route protection: Customer login receives 403 on /admin & Admin APIs', async () => {
    const webAdminRes = await fetch(`${CLIENT}/admin`, {
      headers: { Cookie: custCookie || `token=${custToken}` },
      redirect: 'manual',
    });
    assert.equal(webAdminRes.status, 403, `Expected 403 on Web /admin, got ${webAdminRes.status}`);

    const apiAdminRes = await apiCall('/api/users', { token: custToken });
    assert.equal(apiAdminRes.status, 403, `Expected 403 on GET /api/users, got ${apiAdminRes.status}`);
    return 'Web /admin -> 403, API /api/users -> 403';
  });

  await test('SEC-02', 'Invalid token: Request with invalid JWT returns 401', async () => {
    const res = await apiCall('/api/auth/profile', { token: 'invalid.jwt.token.value' });
    assert.equal(res.status, 401, `Expected 401 for invalid token, got ${res.status}`);
    return 'Invalid token rejected with 401 Unauthorized';
  });

  await test('SEC-03', 'Password in response: Login and profile responses never expose password hash', async () => {
    assert.equal(custLogin.body.user.password, undefined, 'Password must not be in login response');
    const profileRes = await apiCall('/api/auth/profile', { token: custToken });
    assert.equal(profileRes.status, 200);
    assert.equal(profileRes.body.password, undefined, 'Password must not be in profile response');
    return 'password field is undefined in login and profile payloads';
  });

  // ===========================================================================
  // TASK 5.4: Final E2E Testing (E2E-01 .. E2E-06)
  // ===========================================================================
  console.log('\n--- Task 5.4: Final E2E Testing (E2E-01 .. E2E-06) ---');

  const prodRes = await apiCall('/api/products?limit=20');
  assert.equal(prodRes.status, 200);
  const targetProduct =
    (prodRes.body.products || []).find((p) =>
      (p.variants || []).some((v) => v.isActive && v.inventory >= 10)
    ) || prodRes.body.products[0];
  const targetVariant = targetProduct.variants.find((v) => v.isActive && v.inventory >= 10);
  assert.ok(targetVariant, 'Expected an in-stock variant for Final E2E purchase flows');

  const adminLogin = await apiCall('/api/auth/login', {
    method: 'POST',
    body: { email: 'admin@aevo.com', password: 'admin123' },
  });
  assert.equal(adminLogin.status, 200);
  const adminToken = adminLogin.body.token;

  let createdUserToken = null;
  let createdOrderId = null;

  await test(
    'E2E-01',
    'Full purchase flow: Register -> Login -> Browse -> Add to cart -> Checkout -> Complete -> Order history',
    async () => {
      // 1. Register new user
      const uniqueEmail = `phase5.buyer.${Date.now()}@aevo.com`;
      const regRes = await apiCall('/api/auth/register', {
        method: 'POST',
        body: {
          email: uniqueEmail,
          password: 'password123',
          fullName: 'Phase 5 E2E Buyer',
          address: '123 Le Loi, District 1',
          phone: '0909111222',
        },
      });
      assert.equal(regRes.status, 201, `Registration failed: ${JSON.stringify(regRes.body)}`);

      // 2. Login
      const loginRes = await apiCall('/api/auth/login', {
        method: 'POST',
        body: { email: uniqueEmail, password: 'password123' },
      });
      assert.equal(loginRes.status, 200);
      createdUserToken = loginRes.body.token;

      // 3. Browse product detail
      const detailRes = await apiCall(`/api/products/slug/${targetProduct.slug}`);
      assert.equal(detailRes.status, 200);
      assert.equal(detailRes.body.id, targetProduct.id);

      // 4. Add to cart
      const cartAddRes = await apiCall('/api/cart/items', {
        method: 'POST',
        token: createdUserToken,
        body: { variantId: targetVariant.id, quantity: 1 },
      });
      assert.equal(cartAddRes.status, 200);
      assert.equal(cartAddRes.body.items.length, 1);

      // 5. Checkout & Complete order
      const orderRes = await apiCall('/api/orders', {
        method: 'POST',
        token: createdUserToken,
        body: {
          shippingAddress: {
            fullName: 'Phase 5 E2E Buyer',
            email: uniqueEmail,
            phone: '0909111222',
            address: '123 Le Loi, District 1',
            city: 'Ho Chi Minh City',
          },
          paymentMethod: 'cod',
        },
      });
      assert.equal(orderRes.status, 201, `Checkout failed: ${JSON.stringify(orderRes.body)}`);
      createdOrderId = orderRes.body.id;

      // 6. Verify user can view order in order history
      const myOrdersRes = await apiCall('/api/orders', { token: createdUserToken });
      assert.equal(myOrdersRes.status, 200);
      assert.ok(
        myOrdersRes.body.some((o) => o.id === createdOrderId),
        'Expected newly created order in user order history'
      );

      return `User ${uniqueEmail} created order ${orderRes.body.orderNumber} (points earned: ${orderRes.body.earnedPoints})`;
    }
  );

  await test('E2E-02', 'Guest checkout: Add to cart -> Guest checkout -> Order created', async () => {
    // 1. Add item to guest cart
    const guestCartRes = await apiCall('/api/cart/items', {
      method: 'POST',
      body: { variantId: targetVariant.id, quantity: 1 },
    });
    assert.equal(guestCartRes.status, 200);
    const sessionCookie = extractCookie(guestCartRes.setCookies, 'sessionId');

    // 2. Guest checkout
    const guestEmail = `guest.phase5.${Date.now()}@aevo.com`;
    const checkoutRes = await apiCall('/api/orders', {
      method: 'POST',
      cookie: sessionCookie,
      body: {
        sessionId: guestCartRes.body.sessionId,
        shippingAddress: {
          fullName: 'Phase 5 Guest Buyer',
          email: guestEmail,
          phone: '0908888999',
          address: '456 Nguyen Hue Blvd',
          city: 'Ho Chi Minh City',
        },
        paymentMethod: 'cod',
      },
    });
    assert.equal(checkoutRes.status, 201, `Guest checkout failed: ${JSON.stringify(checkoutRes.body)}`);
    assert.match(checkoutRes.body.orderNumber, /^AEVO-/);
    return `Guest order ${checkoutRes.body.orderNumber} created`;
  });

  await test(
    'E2E-03',
    'Admin order update: Admin views order -> Updates status -> Status & history updated',
    async () => {
      assert.ok(createdOrderId, 'Requires order from E2E-01');

      // 1. Admin views order detail
      const viewRes = await apiCall(`/api/orders/${createdOrderId}`, { token: adminToken });
      assert.equal(viewRes.status, 200);
      assert.equal(viewRes.body.status, 'PENDING');

      // 2. Admin updates status to CONFIRMED
      const updateRes = await apiCall(`/api/orders/${createdOrderId}/status`, {
        method: 'PUT',
        token: adminToken,
        body: {
          status: 'CONFIRMED',
          note: 'Order confirmed in Phase 5 Final E2E test',
        },
      });
      assert.equal(updateRes.status, 200);
      assert.equal(updateRes.body.status, 'CONFIRMED');
      assert.ok(
        updateRes.body.statusHistory.some((h) => h.status === 'CONFIRMED'),
        'Expected CONFIRMED entry in order statusHistory'
      );
      return `Order ${updateRes.body.orderNumber} updated PENDING -> CONFIRMED`;
    }
  );

  await test(
    'E2E-04',
    'Discount + Points: Checkout applying both 5-char discount code and loyalty points',
    async () => {
      // 1. Admin creates a fresh 5-char discount code (10% off)
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let code = 'P5';
      while (code.length < 5) code += chars[Math.floor(Math.random() * chars.length)];

      const discCreateRes = await apiCall('/api/discounts', {
        method: 'POST',
        token: adminToken,
        body: { code, discountType: 'percentage', discountValue: 10, maxUses: 5 },
      });
      assert.equal(discCreateRes.status, 201);

      // 2. Check buyer's earned loyalty points from E2E-01
      const balRes = await apiCall('/api/loyalty/points', { token: createdUserToken });
      assert.equal(balRes.status, 200);
      const pointsToUse = Math.min(10, balRes.body.points);
      assert.ok(pointsToUse > 0, 'Expected buyer to have earned loyalty points from E2E-01');

      // 3. Add item to cart and checkout with BOTH discountCode and usedLoyaltyPoints
      await apiCall('/api/cart/items', {
        method: 'POST',
        token: createdUserToken,
        body: { variantId: targetVariant.id, quantity: 1 },
      });

      const orderRes = await apiCall('/api/orders', {
        method: 'POST',
        token: createdUserToken,
        body: {
          shippingAddress: {
            fullName: 'Phase 5 E2E Buyer',
            email: 'buyer@aevo.com',
            phone: '0909111222',
            address: '123 Le Loi, District 1',
            city: 'Ho Chi Minh City',
          },
          discountCode: code,
          usedLoyaltyPoints: pointsToUse,
          paymentMethod: 'cod',
        },
      });
      assert.equal(orderRes.status, 201, `Discount+Points checkout failed: ${JSON.stringify(orderRes.body)}`);
      assert.ok(orderRes.body.discountAmount > 0, 'Expected discountAmount > 0');
      assert.equal(orderRes.body.usedLoyaltyPoints, pointsToUse);
      assert.equal(orderRes.body.loyaltyDiscount, pointsToUse * 1000);
      return `Applied coupon ${code} (-${orderRes.body.discountAmount} VND) + ${pointsToUse} pts (-${orderRes.body.loyaltyDiscount} VND)`;
    }
  );

  await test('E2E-05', 'Review as guest: Submit guest comment on product detail -> Comment visible', async () => {
    const commentText = `Phase 5 Guest Review Comment ${Date.now()}`;
    const postRes = await apiCall('/api/reviews', {
      method: 'POST',
      body: {
        productId: targetProduct.id,
        guestName: 'Phase 5 Guest',
        comment: commentText,
      },
    });
    assert.equal(postRes.status, 201);
    assert.equal(postRes.body.rating, null);

    const listRes = await apiCall(`/api/reviews/product/${targetProduct.id}`);
    assert.equal(listRes.status, 200);
    assert.ok(
      listRes.body.reviews.some((r) => r.comment === commentText),
      'Expected guest comment to be visible in product reviews'
    );
    return `Guest comment visible on product ${targetProduct.slug}`;
  });

  await test(
    'E2E-06',
    'Review as user: Authenticated user submits review + 5-star rating -> Rating visible',
    async () => {
      const reviewText = `Phase 5 Authenticated 5-Star Review ${Date.now()}`;
      const postRes = await apiCall('/api/reviews', {
        method: 'POST',
        token: createdUserToken,
        body: {
          productId: targetProduct.id,
          rating: 5,
          comment: reviewText,
        },
      });
      assert.equal(postRes.status, 201);
      assert.equal(postRes.body.rating, 5);
      assert.equal(postRes.body.isVerified, true, 'Buyer who ordered product should be marked verified');

      const listRes = await apiCall(`/api/reviews/product/${targetProduct.id}`);
      assert.equal(listRes.status, 200);
      const found = listRes.body.reviews.find((r) => r.comment === reviewText);
      assert.ok(found, 'Expected authenticated review in product reviews list');
      assert.equal(found.rating, 5);
      return `Authenticated 5-star verified review visible (avg=${listRes.body.averageRating}★)`;
    }
  );

  // ===========================================================================
  // TASK 5.5: Horizontal Scaling Preparation (SCALE-01 .. SCALE-02)
  // ===========================================================================
  console.log('\n--- Task 5.5: Horizontal Scaling Preparation (SCALE-01 .. SCALE-02) ---');

  await test(
    'SCALE-01',
    'Stateless check: API uses JWT + Redis session/cart store with X-Instance-Id header',
    async () => {
      const healthRes = await apiCall('/health');
      assert.equal(healthRes.status, 200);
      assert.equal(healthRes.body.stateless, true);
      assert.equal(healthRes.body.authMode, 'jwt');
      assert.equal(healthRes.body.redis?.connected, true, 'Expected Redis to be connected in Docker stack');
      assert.equal(healthRes.body.redis?.store, 'redis');
      const instanceHeader = healthRes.headers.get('x-instance-id');
      assert.ok(instanceHeader, 'Expected X-Instance-Id response header');

      // Verify session state is persisted inside the Redis container
      const keysOut = execSync('docker compose exec -T redis redis-cli KEYS "aevo:session:*"', {
        cwd: ROOT_DIR,
        encoding: 'utf8',
      }).trim();
      assert.match(keysOut, /aevo:session:/, 'Expected active session/cart keys stored in Redis');
      return `stateless=true, authMode=jwt, redis=connected, X-Instance-Id=${instanceHeader}`;
    }
  );

  await test(
    'SCALE-02',
    'Multiple instances: Load balancing config (docker-compose.scale.yml, nginx.conf, docs) ready',
    async () => {
      const scaleComposePath = path.join(ROOT_DIR, 'docker-compose.scale.yml');
      const nginxConfPath = path.join(ROOT_DIR, 'docker/nginx.conf');
      const scalingDocPath = path.join(ROOT_DIR, 'docs/HORIZONTAL_SCALING.md');

      assert.equal(fs.existsSync(scaleComposePath), true, 'docker-compose.scale.yml must exist');
      assert.equal(fs.existsSync(nginxConfPath), true, 'docker/nginx.conf must exist');
      assert.equal(fs.existsSync(scalingDocPath), true, 'docs/HORIZONTAL_SCALING.md must exist');

      const nginxConf = fs.readFileSync(nginxConfPath, 'utf8');
      assert.match(nginxConf, /upstream\s+aevo_api_cluster/);
      assert.match(nginxConf, /server\s+api-1:3001/);
      assert.match(nginxConf, /server\s+api-2:3001/);

      // Validate merged compose config syntax via `docker compose config`
      const mergedConfig = execSync(
        'docker compose -f docker-compose.yml -f docker-compose.scale.yml config --services',
        { cwd: ROOT_DIR, encoding: 'utf8' }
      );
      for (const svc of ['api-1', 'api-2', 'nginx-lb', 'redis', 'db', 'web']) {
        assert.match(mergedConfig, new RegExp(`^${svc}$`, 'm'), `Missing service ${svc} in scale config`);
      }
      return 'Verified multi-instance compose config (api-1, api-2, nginx-lb) & scaling documentation';
    }
  );

  // ------------------------------------------------------------------ summary
  const failed = results.filter((r) => !r.ok);
  console.log('\n' + '='.repeat(68));
  console.log(`Phase 5 E2E Summary: ${results.length - failed.length}/${results.length} passed`);
  console.log('='.repeat(68));
  if (failed.length) {
    console.log('FAILED:');
    for (const f of failed) {
      console.log(`  - ${f.id} ${f.name}: ${f.detail}`);
    }
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('Phase 5 E2E crashed:', err);
  process.exitCode = 1;
});
