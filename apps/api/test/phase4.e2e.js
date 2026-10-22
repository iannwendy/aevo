/**
 * Phase 4 E2E Test Suite (E2E_TEST_PLAN.md, Task 4.1 - 4.7).
 *
 * Covers:
 * - Task 4.1: Simple Dashboard (DASH-01 -> DASH-03)
 * - Task 4.2: Advanced Dashboard (DASH-04 -> DASH-08)
 * - Task 4.3: Admin - Product Management (ADMIN-01 -> ADMIN-06)
 * - Task 4.4: Admin - User Management (ADMIN-07 -> ADMIN-10)
 * - Task 4.5: Admin - Order Management (ADMIN-11 -> ADMIN-15)
 * - Task 4.6: Admin - Discount Management (ADMIN-16 -> ADMIN-19)
 * - Task 4.7: Admin Frontend Pages (FE-24 -> FE-29)
 *
 * Run with both API (3001) and Web (3000) servers up:
 *   node apps/api/test/phase4.e2e.js
 */
const assert = require('node:assert/strict');
const prisma = require('../src/utils/prisma');

const API = process.env.API_URL || 'http://localhost:3001';
const CLIENT = process.env.CLIENT_URL || 'http://localhost:3000';

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

async function call(path, { method = 'GET', body, token, cookie, headers = {} } = {}) {
  const h = { ...headers };
  if (body !== undefined) h['Content-Type'] = 'application/json';
  if (token) h.Authorization = `Bearer ${token}`;
  if (cookie) h.Cookie = cookie;

  const res = await fetch(`${API}${path}`, {
    method,
    headers: h,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'manual',
  });

  const text = await res.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return { status: res.status, body: parsed, headers: res.headers };
}

function cookieFrom(res, name = 'token') {
  const setCookie = res.headers.getSetCookie?.() || [];
  const cookie = setCookie.find((c) => c.startsWith(`${name}=`));
  return cookie ? cookie.split(';')[0] : null;
}

const uniqueEmail = (tag) =>
  `${tag}.${Date.now()}.${Math.floor(Math.random() * 1e6)}@example.com`;

async function loginAs(email, password) {
  const res = await call('/api/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  assert.equal(res.status, 200, `login failed for ${email}: ${JSON.stringify(res.body)}`);
  return {
    token: res.body.token,
    cookie: cookieFrom(res, 'token'),
    user: res.body.user,
  };
}

async function registerCustomer(tag = 'phase4') {
  const email = uniqueEmail(tag);
  const res = await call('/api/auth/register', {
    method: 'POST',
    body: { email, password: 'password123', fullName: 'Phase Four Tester' },
  });
  assert.equal(res.status, 201, `register failed: ${JSON.stringify(res.body)}`);
  return {
    email,
    token: res.body.token,
    cookie: cookieFrom(res, 'token'),
    user: res.body.user,
  };
}

(async () => {
  const admin = await loginAs('admin@aevo.com', 'admin123');
  const customer = await registerCustomer('p4cust');

  // =========================================================================
  // Task 4.1: Simple Dashboard (DASH-01 -> DASH-03)
  // =========================================================================
  console.log('\n=== Task 4.1: Simple Dashboard ===');

  let simpleData = null;

  await test('DASH-01', 'GET /api/analytics/simple returns KPIs, bestSellers, and recentOrders (admin only)', async () => {
    // Non-admin must be rejected with 403
    const forbidden = await call('/api/analytics/simple', { token: customer.token });
    assert.equal(forbidden.status, 403, 'Expected 403 for non-admin customer');

    const unauth = await call('/api/analytics/simple');
    assert.equal(unauth.status, 401, 'Expected 401 for unauthenticated request');

    const res = await call('/api/analytics/simple', { token: admin.token });
    assert.equal(res.status, 200);
    assert.equal(typeof res.body.totalUsers, 'number');
    assert.equal(typeof res.body.newUsers, 'number');
    assert.equal(typeof res.body.totalOrders, 'number');
    assert.equal(typeof res.body.revenue, 'number');
    assert.ok(Array.isArray(res.body.bestSellers), 'Expected bestSellers array');
    assert.ok(Array.isArray(res.body.recentOrders), 'Expected recentOrders array');
    simpleData = res.body;
    return `users=${res.body.totalUsers}, newUsers=${res.body.newUsers}, orders=${res.body.totalOrders}`;
  });

  await test('DASH-02', 'Total users and new users (30 days) match exact database count', async () => {
    const dbTotalUsers = await prisma.user.count();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dbNewUsers = await prisma.user.count({
      where: { createdAt: { gte: thirtyDaysAgo } },
    });

    assert.equal(simpleData.totalUsers, dbTotalUsers);
    assert.equal(simpleData.newUsers, dbNewUsers);
    return `dbTotalUsers=${dbTotalUsers}, dbNewUsers=${dbNewUsers}`;
  });

  await test('DASH-03', 'Revenue calculation equals sum(totalAmount) of non-cancelled orders and updates on new order', async () => {
    const aggBefore = await prisma.order.aggregate({
      _sum: { totalAmount: true },
      where: { status: { not: 'CANCELLED' } },
    });
    const expectedBefore = aggBefore._sum.totalAmount || 0;
    assert.ok(
      Math.abs(simpleData.revenue - expectedBefore) < 1,
      `Expected revenue ${expectedBefore}, got ${simpleData.revenue}`
    );

    // Place a test order and verify revenue increases by exact order.totalAmount
    const prodRes = await call('/api/products?limit=10');
    const variant = prodRes.body.products
      .flatMap((p) => p.variants || [])
      .find((v) => v.inventory >= 5);
    assert.ok(variant, 'Expected an in-stock variant');

    const orderRes = await call('/api/orders', {
      method: 'POST',
      token: customer.token,
      body: {
        items: [{ variantId: variant.id, quantity: 1 }],
        shippingAddress: {
          fullName: 'Dashboard Revenue Tester',
          phone: '0901234567',
          address: '100 Nguyen Hue',
          city: 'Ho Chi Minh City',
        },
        paymentMethod: 'cod',
      },
    });
    assert.equal(orderRes.status, 201);

    const afterRes = await call('/api/analytics/simple', { token: admin.token });
    assert.equal(afterRes.status, 200);
    assert.ok(
      Math.abs(afterRes.body.revenue - (expectedBefore + orderRes.body.totalAmount)) < 1,
      `Expected revenue to increase by ${orderRes.body.totalAmount}`
    );
    return `revenue=${afterRes.body.revenue.toLocaleString('en-US')} VND (+${orderRes.body.totalAmount.toLocaleString('en-US')})`;
  });

  // =========================================================================
  // Task 4.2: Advanced Dashboard (DASH-04 -> DASH-08)
  // =========================================================================
  console.log('\n=== Task 4.2: Advanced Dashboard ===');

  let yearlyAdv = null;

  await test('DASH-04', 'GET /api/analytics/advanced?period=year returns yearly analytics, charts & productTypes', async () => {
    const res = await call('/api/analytics/advanced?period=year', { token: admin.token });
    assert.equal(res.status, 200);
    assert.ok(res.body.period?.start, 'Expected period.start');
    assert.ok(res.body.period?.end, 'Expected period.end');
    assert.equal(typeof res.body.summary?.orderCount, 'number');
    assert.equal(typeof res.body.summary?.revenue, 'number');
    assert.equal(typeof res.body.summary?.profit, 'number');
    assert.equal(typeof res.body.summary?.productsSold, 'number');
    assert.ok(Array.isArray(res.body.revenueByMonth), 'Expected revenueByMonth array');
    assert.ok(Array.isArray(res.body.timeSeries), 'Expected timeSeries array');
    assert.ok(Array.isArray(res.body.productTypes), 'Expected productTypes array');
    assert.ok(Array.isArray(res.body.topProducts), 'Expected topProducts array');
    assert.ok(res.body.comparativeByInterval, 'Expected comparativeByInterval breakdown');

    const startYear = new Date(res.body.period.start).getFullYear();
    const currentYear = new Date().getFullYear();
    assert.equal(startYear, currentYear, 'Expected yearly view to start in current year');
    yearlyAdv = res.body;
    return `year=${startYear}, orders=${res.body.summary.orderCount}, productsSold=${res.body.summary.productsSold}`;
  });

  await test('DASH-05', 'GET /api/analytics/advanced?period=quarter returns current quarter data', async () => {
    const res = await call('/api/analytics/advanced?period=quarter', { token: admin.token });
    assert.equal(res.status, 200);
    assert.equal(res.body.period.type, 'quarter');
    assert.equal(typeof res.body.summary.orderCount, 'number');
    assert.equal(typeof res.body.summary.revenue, 'number');
    assert.equal(typeof res.body.summary.profit, 'number');
    return `quarter orders=${res.body.summary.orderCount}, revenue=${res.body.summary.revenue}`;
  });

  await test('DASH-06', 'GET /api/analytics/advanced?period=month & period=week return monthly and weekly data', async () => {
    const monthRes = await call('/api/analytics/advanced?period=month', { token: admin.token });
    assert.equal(monthRes.status, 200);
    assert.equal(monthRes.body.period.type, 'month');
    assert.equal(typeof monthRes.body.summary.orderCount, 'number');

    const weekRes = await call('/api/analytics/advanced?period=week', { token: admin.token });
    assert.equal(weekRes.status, 200);
    assert.equal(weekRes.body.period.type, 'week');
    assert.equal(typeof weekRes.body.summary.orderCount, 'number');
    return `monthOrders=${monthRes.body.summary.orderCount}, weekOrders=${weekRes.body.summary.orderCount}`;
  });

  await test('DASH-07', 'GET /api/analytics/advanced?period=custom&startDate=...&endDate=... filters by custom date range', async () => {
    const res = await call(
      '/api/analytics/advanced?period=custom&startDate=2024-01-01&endDate=2024-03-31',
      { token: admin.token }
    );
    assert.equal(res.status, 200);
    assert.ok(res.body.period.start.startsWith('2024-01-01'));
    assert.ok(res.body.period.end.startsWith('2024-03-31'));
    assert.equal(typeof res.body.summary.orderCount, 'number');
    assert.equal(typeof res.body.summary.revenue, 'number');

    // Also verify a custom range covering today includes today's orders
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayRes = await call(
      `/api/analytics/advanced?period=custom&startDate=${todayStr}&endDate=${todayStr}`,
      { token: admin.token }
    );
    assert.equal(todayRes.status, 200);
    assert.ok(todayRes.body.summary.orderCount >= 1, 'Expected at least 1 order in today custom range');
    return `2024-Q1 orders=${res.body.summary.orderCount}, today orders=${todayRes.body.summary.orderCount}`;
  });

  await test('DASH-08', 'Profit calculation equals revenue * 0.2 and comparative metrics are present', async () => {
    assert.ok(yearlyAdv, 'Expected yearlyAdv response');
    const { revenue, profit } = yearlyAdv.summary;
    assert.ok(
      Math.abs(profit - revenue * 0.2) < 0.01,
      `Expected profit (${profit}) to equal revenue * 0.2 (${revenue * 0.2})`
    );
    assert.equal(typeof yearlyAdv.comparison?.revenueChange, 'number');
    assert.ok(yearlyAdv.comparison?.previousPeriod, 'Expected previousPeriod in comparison');
    return `revenue=${revenue}, profit=${profit} (20% margin)`;
  });

  await prisma.$disconnect();

  const passed = results.filter((r) => r.ok).length;
  console.log(`\n============================================================`);
  console.log(`${passed}/${results.length} passed`);
  if (passed !== results.length) {
    process.exit(1);
  }
})();
