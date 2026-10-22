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

async function callWeb(path, { cookie, headers = {} } = {}) {
  const h = { ...headers };
  if (cookie) h.Cookie = cookie;
  const res = await fetch(`${CLIENT}${path}`, {
    headers: h,
    redirect: 'manual',
  });
  const text = await res.text();
  return { status: res.status, html: text, headers: res.headers };
}

function cookieFrom(res, name = 'token') {
  const setCookie = res.headers.getSetCookie?.() || [];
  const cookie = setCookie.find((c) => c.startsWith(`${name}=`));
  return cookie ? cookie.split(';')[0] : null;
}

function randomCode5(prefix = 'P') {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let out = prefix.toUpperCase().slice(0, 1);
  while (out.length < 5) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
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

  // =========================================================================
  // Task 4.3: Admin - Product Management (ADMIN-01 -> ADMIN-06)
  // =========================================================================
  console.log('\n=== Task 4.3: Admin - Product Management ===');

  const catRes = await call('/api/categories');
  assert.equal(catRes.status, 200);
  const laptopsCategory =
    catRes.body.find((c) => c.slug === 'laptops') || catRes.body[0];
  assert.ok(laptopsCategory, 'Expected a valid category');

  let createdProductId = null;
  let createdVariantId = null;

  await test('ADMIN-01', 'Admin can POST /api/products to create a product (non-admin rejected)', async () => {
    const nonAdmin = await call('/api/products', {
      method: 'POST',
      token: customer.token,
      body: {
        name: 'Forbidden Product',
        description: 'Should fail',
        brand: 'AEVO',
        categoryId: laptopsCategory.id,
      },
    });
    assert.equal(nonAdmin.status, 403);

    const res = await call('/api/products', {
      method: 'POST',
      token: admin.token,
      body: {
        name: `AEVO Pro Workstation ${Date.now()}`,
        description:
          'Line 1: Precision-milled CNC aluminum chassis.\nLine 2: Dual-fan vapor chamber thermal system.\nLine 3: Calibrated 4K OLED reference display.\nLine 4: Thunderbolt 4 connectivity.\nLine 5: Built for studio engineers.',
        brand: 'AEVO',
        categoryId: laptopsCategory.id,
        isNewArrival: true,
        isBestSeller: false,
      },
    });
    assert.equal(res.status, 201, `Create product failed: ${JSON.stringify(res.body)}`);
    assert.ok(res.body.id);
    assert.equal(res.body.isActive, true);
    assert.equal(res.body.brand, 'AEVO');

    // Clean up basic product right after verifying
    await call(`/api/products/${res.body.id}`, { method: 'DELETE', token: admin.token });
    return `id=${res.body.id}, slug=${res.body.slug}`;
  });

  await test('ADMIN-02', 'Admin can create product with variants array (>= 2 variants with independent inventory)', async () => {
    const skuPrefix = `AEVO-P4-${Date.now().toString(36).toUpperCase()}`;
    const res = await call('/api/products', {
      method: 'POST',
      token: admin.token,
      body: {
        name: `AEVO Studio Book ${Date.now()}`,
        description:
          'Line 1: Workstation class mobile compute.\nLine 2: ECC-ready high bandwidth memory.\nLine 3: Gen5 NVMe RAID storage.\nLine 4: Reference color accuracy.\nLine 5: Whisper-quiet acoustics.',
        brand: 'ASUS',
        categoryId: laptopsCategory.id,
        isNewArrival: true,
        variants: [
          {
            name: '32GB RAM / 1TB NVMe SSD',
            sku: `${skuPrefix}-32-1T`,
            price: 45990000,
            comparePrice: 48990000,
            inventory: 15,
          },
          {
            name: '64GB RAM / 2TB NVMe SSD',
            sku: `${skuPrefix}-64-2T`,
            price: 56990000,
            comparePrice: 59990000,
            inventory: 8,
          },
        ],
        images: [
          'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=1000',
          'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=1000',
          'https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?w=1000',
        ],
      },
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.variants.length, 2);
    assert.equal(res.body.minPrice, 45990000);
    createdProductId = res.body.id;
    createdVariantId = res.body.variants[0].id;
    return `variants=${res.body.variants.length}, minPrice=${res.body.minPrice}`;
  });

  await test('ADMIN-03', 'Admin creates product with >= 3 images ordered by position with primary image flagged', async () => {
    const getRes = await call(`/api/products/${createdProductId}`);
    assert.equal(getRes.status, 200);
    assert.ok(getRes.body.images.length >= 3, 'Expected at least 3 images');
    assert.equal(getRes.body.images[0].isPrimary, true);
    assert.equal(getRes.body.images[0].position, 0);
    assert.equal(getRes.body.images[1].position, 1);
    assert.equal(getRes.body.images[2].position, 2);
    return `images=${getRes.body.images.length}, primary=${getRes.body.images[0].isPrimary}`;
  });

  await test('ADMIN-04', 'Admin can PUT /api/products/:id to update product info and add/remove variants', async () => {
    const updateRes = await call(`/api/products/${createdProductId}`, {
      method: 'PUT',
      token: admin.token,
      body: {
        name: `AEVO Studio Book Updated ${Date.now()}`,
        brand: 'LENOVO',
        isBestSeller: true,
      },
    });
    assert.equal(updateRes.status, 200);
    assert.equal(updateRes.body.brand, 'LENOVO');
    assert.equal(updateRes.body.isBestSeller, true);

    // Add a 3rd variant via POST /api/products/:id/variants
    const addVarRes = await call(`/api/products/${createdProductId}/variants`, {
      method: 'POST',
      token: admin.token,
      body: {
        name: '128GB RAM / 4TB NVMe SSD',
        sku: `AEVO-128-${Date.now().toString(36).toUpperCase()}`,
        price: 72990000,
        inventory: 4,
      },
    });
    assert.equal(addVarRes.status, 201);

    // Remove the 3rd variant via DELETE /api/products/:id/variants/:variantId
    const delVarRes = await call(
      `/api/products/${createdProductId}/variants/${addVarRes.body.id}`,
      {
        method: 'DELETE',
        token: admin.token,
      }
    );
    assert.equal(delVarRes.status, 200);
    assert.equal(delVarRes.body.isActive, false);
    return `brand=${updateRes.body.brand}, added & removed variant=${addVarRes.body.id}`;
  });

  await test('ADMIN-05', 'Admin can update variant inventory via PUT /api/products/variants/:variantId/inventory', async () => {
    const invRes = await call(`/api/products/variants/${createdVariantId}/inventory`, {
      method: 'PUT',
      token: admin.token,
      body: { inventory: 42 },
    });
    assert.equal(invRes.status, 200);
    assert.equal(invRes.body.inventory, 42);

    const checkProd = await call(`/api/products/${createdProductId}`);
    const updatedVariant = checkProd.body.variants.find((v) => v.id === createdVariantId);
    assert.equal(updatedVariant.inventory, 42);
    return `variantId=${createdVariantId}, inventory=${updatedVariant.inventory}`;
  });

  await test('ADMIN-06', 'Admin can DELETE /api/products/:id to soft-delete product (isActive = false)', async () => {
    const delRes = await call(`/api/products/${createdProductId}`, {
      method: 'DELETE',
      token: admin.token,
    });
    assert.equal(delRes.status, 200);
    assert.equal(delRes.body.isActive, false);

    // Public GET /api/products/:id should now return 404
    const publicGet = await call(`/api/products/${createdProductId}`);
    assert.equal(publicGet.status, 404);
    return `id=${createdProductId}, isActive=${delRes.body.isActive}`;
  });

  // =========================================================================
  // Task 4.4: Admin - User Management (ADMIN-07 -> ADMIN-10)
  // =========================================================================
  console.log('\n=== Task 4.4: Admin - User Management ===');

  const targetUser = await registerCustomer('john.admin44');

  await test('ADMIN-07', 'GET /api/users returns paginated users (admin only)', async () => {
    const forbidden = await call('/api/users', { token: customer.token });
    assert.equal(forbidden.status, 403);

    const res = await call('/api/users?page=1&limit=10', { token: admin.token });
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.users));
    assert.equal(res.body.pagination.page, 1);
    assert.equal(res.body.pagination.limit, 10);
    assert.ok(res.body.pagination.total >= 2);
    // Ensure password is never exposed
    assert.ok(res.body.users.every((u) => u.password === undefined));
    return `count=${res.body.users.length}, total=${res.body.pagination.total}`;
  });

  await test('ADMIN-08', 'GET /api/users?search=... filters users by name or email and GET /api/users/:id returns detail', async () => {
    const searchRes = await call(
      `/api/users?search=${encodeURIComponent(targetUser.email)}`,
      { token: admin.token }
    );
    assert.equal(searchRes.status, 200);
    assert.equal(searchRes.body.users.length, 1);
    assert.equal(searchRes.body.users[0].id, targetUser.user.id);

    const detailRes = await call(`/api/users/${targetUser.user.id}`, { token: admin.token });
    assert.equal(detailRes.status, 200);
    assert.equal(detailRes.body.email, targetUser.email);
    assert.ok(Array.isArray(detailRes.body.addresses));
    assert.ok(Array.isArray(detailRes.body.orders));

    // Also test PUT /api/users/:id update user info
    const updRes = await call(`/api/users/${targetUser.user.id}`, {
      method: 'PUT',
      token: admin.token,
      body: { fullName: 'John Admin Updated' },
    });
    assert.equal(updRes.status, 200);
    assert.equal(updRes.body.fullName, 'John Admin Updated');
    return `found=${detailRes.body.email}, updatedName=${updRes.body.fullName}`;
  });

  await test('ADMIN-09', 'PUT /api/users/:id/ban sets isActive = false and blocks user session/login', async () => {
    const banRes = await call(`/api/users/${targetUser.user.id}/ban`, {
      method: 'PUT',
      token: admin.token,
    });
    assert.equal(banRes.status, 200);
    assert.equal(banRes.body.isActive, false);

    // Banned user's active token must immediately be rejected (401)
    const profileRes = await call('/api/auth/profile', { token: targetUser.token });
    assert.equal(profileRes.status, 401);

    // Banned user attempting to login must receive 403
    const loginAttempt = await call('/api/auth/login', {
      method: 'POST',
      body: { email: targetUser.email, password: 'password123' },
    });
    assert.equal(loginAttempt.status, 403);
    return `userId=${targetUser.user.id}, isActive=${banRes.body.isActive}`;
  });

  await test('ADMIN-10', 'PUT /api/users/:id/unban sets isActive = true and restores user access', async () => {
    const unbanRes = await call(`/api/users/${targetUser.user.id}/unban`, {
      method: 'PUT',
      token: admin.token,
    });
    assert.equal(unbanRes.status, 200);
    assert.equal(unbanRes.body.isActive, true);

    const profileRes = await call('/api/auth/profile', { token: targetUser.token });
    assert.equal(profileRes.status, 200);
    assert.equal(profileRes.body.id, targetUser.user.id);
    return `userId=${targetUser.user.id}, isActive=${unbanRes.body.isActive}`;
  });

  // =========================================================================
  // Task 4.5: Admin - Order Management (ADMIN-11 -> ADMIN-15)
  // =========================================================================
  console.log('\n=== Task 4.5: Admin - Order Management ===');

  let adminTestOrderId = null;

  await test('ADMIN-11', 'GET /api/orders/admin/all returns paginated orders sorted newest first (default limit=20)', async () => {
    const forbidden = await call('/api/orders/admin/all', { token: customer.token });
    assert.equal(forbidden.status, 403);

    const res = await call('/api/orders/admin/all', { token: admin.token });
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.orders));
    assert.equal(res.body.pagination.page, 1);
    assert.equal(res.body.pagination.limit, 20);
    assert.ok(res.body.orders.length >= 1);

    // Verify descending order by createdAt
    for (let i = 1; i < res.body.orders.length; i++) {
      const prevTime = new Date(res.body.orders[i - 1].createdAt).getTime();
      const currTime = new Date(res.body.orders[i].createdAt).getTime();
      assert.ok(prevTime >= currTime, 'Expected orders sorted newest first');
    }

    adminTestOrderId = res.body.orders[0].id;
    return `page=1, limit=${res.body.pagination.limit}, total=${res.body.pagination.total}`;
  });

  await test('ADMIN-12', 'GET /api/orders/admin/all?status=PENDING returns only PENDING orders', async () => {
    const res = await call('/api/orders/admin/all?status=PENDING', { token: admin.token });
    assert.equal(res.status, 200);
    assert.ok(res.body.orders.length >= 1);
    assert.ok(
      res.body.orders.every((o) => o.status === 'PENDING'),
      'Expected all filtered orders to have status PENDING'
    );
    return `PENDING orders=${res.body.orders.length}`;
  });

  await test('ADMIN-13', 'GET /api/orders/admin/all filters by date range (startDate/endDate & presets today/yesterday/week/month)', async () => {
    // 1. Historical empty range
    const emptyRes = await call(
      '/api/orders/admin/all?startDate=2024-01-01&endDate=2024-01-31',
      { token: admin.token }
    );
    assert.equal(emptyRes.status, 200);
    assert.ok(Array.isArray(emptyRes.body.orders));

    // 2. Today range
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayRangeRes = await call(
      `/api/orders/admin/all?startDate=${todayStr}&endDate=${todayStr}`,
      { token: admin.token }
    );
    assert.equal(todayRangeRes.status, 200);
    assert.ok(todayRangeRes.body.orders.length >= 1);

    // 3. Preset dateRange=today, week, month
    const presetToday = await call('/api/orders/admin/all?dateRange=today', {
      token: admin.token,
    });
    assert.equal(presetToday.status, 200);
    assert.ok(presetToday.body.orders.length >= 1);

    const presetMonth = await call('/api/orders/admin/all?dateRange=month', {
      token: admin.token,
    });
    assert.equal(presetMonth.status, 200);
    assert.ok(presetMonth.body.orders.length >= 1);
    return `todayRange=${todayRangeRes.body.orders.length}, presetToday=${presetToday.body.orders.length}`;
  });

  await test('ADMIN-14', 'PUT /api/orders/:id/status updates order status to CONFIRMED', async () => {
    assert.ok(adminTestOrderId, 'Expected adminTestOrderId');
    const res = await call(`/api/orders/${adminTestOrderId}/status`, {
      method: 'PUT',
      token: admin.token,
      body: {
        status: 'CONFIRMED',
        note: 'Verified payment and hardware allocation in AEVO Control',
      },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'CONFIRMED');
    return `orderId=${adminTestOrderId}, status=${res.body.status}`;
  });

  await test('ADMIN-15', 'GET /api/orders/:id includes updated status in statusHistory (reverse chronological)', async () => {
    const res = await call(`/api/orders/${adminTestOrderId}`, { token: admin.token });
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'CONFIRMED');
    assert.ok(Array.isArray(res.body.statusHistory));
    assert.ok(res.body.statusHistory.length >= 2);
    // Most recent status must be at index 0
    assert.equal(res.body.statusHistory[0].status, 'CONFIRMED');
    assert.ok(res.body.statusHistory[0].note.includes('AEVO Control'));
    return `historyCount=${res.body.statusHistory.length}, latest=${res.body.statusHistory[0].status}`;
  });

  // =========================================================================
  // Task 4.6: Admin - Discount Management (ADMIN-16 -> ADMIN-19)
  // =========================================================================
  console.log('\n=== Task 4.6: Admin - Discount Management ===');

  let p4DiscountId = null;
  let p4DiscountCode = null;

  await test('ADMIN-16', 'GET /api/discounts returns all discounts with usageCount and orders (admin only)', async () => {
    const forbidden = await call('/api/discounts', { token: customer.token });
    assert.equal(forbidden.status, 403);

    const res = await call('/api/discounts', { token: admin.token });
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.ok(res.body.length >= 1);
    const first = res.body[0];
    assert.equal(typeof first.code, 'string');
    assert.equal(typeof first.usedCount, 'number');
    assert.equal(typeof first.maxUses, 'number');
    assert.ok(Array.isArray(first.usageHistory));
    assert.ok(Array.isArray(first.orders));
    return `count=${res.body.length}, sample=${first.code} (${first.usedCount}/${first.maxUses})`;
  });

  await test('ADMIN-18', 'POST /api/discounts creates a 5-char alphanumeric discount code with maxUses <= 10', async () => {
    p4DiscountCode = randomCode5('D');
    const res = await call('/api/discounts', {
      method: 'POST',
      token: admin.token,
      body: {
        code: p4DiscountCode,
        description: 'Phase 4 Admin Discount Test',
        discountType: 'percentage',
        discountValue: 10,
        maxUses: 5,
      },
    });
    assert.equal(res.status, 201, `Create discount failed: ${JSON.stringify(res.body)}`);
    assert.equal(res.body.code, p4DiscountCode);
    assert.equal(res.body.maxUses, 5);
    assert.equal(res.body.usedCount, 0);
    assert.equal(res.body.isActive, true);
    p4DiscountId = res.body.id;

    // Also test PUT /api/discounts/:id to update description / maxUses
    const updRes = await call(`/api/discounts/${p4DiscountId}`, {
      method: 'PUT',
      token: admin.token,
      body: { maxUses: 8, description: 'Updated Phase 4 Discount' },
    });
    assert.equal(updRes.status, 200);
    assert.equal(updRes.body.maxUses, 8);
    return `code=${p4DiscountCode}, id=${p4DiscountId}, maxUses=${updRes.body.maxUses}`;
  });

  await test('ADMIN-17', 'Discount detail tracks usedCount and lists orders where coupon was applied', async () => {
    // Place an order using p4DiscountCode so it has 1 applied order
    const prodRes = await call('/api/products?limit=10');
    const variant = prodRes.body.products
      .flatMap((p) => p.variants || [])
      .find((v) => v.inventory >= 5);
    assert.ok(variant);

    const orderRes = await call('/api/orders', {
      method: 'POST',
      token: customer.token,
      body: {
        items: [{ variantId: variant.id, quantity: 1 }],
        discountCode: p4DiscountCode,
        shippingAddress: {
          fullName: 'Discount Usage Tester',
          phone: '0909888777',
          address: '200 Le Loi',
          city: 'Ho Chi Minh City',
        },
        paymentMethod: 'cod',
      },
    });
    assert.equal(orderRes.status, 201);

    const detailRes = await call(`/api/discounts/${p4DiscountId}`, { token: admin.token });
    assert.equal(detailRes.status, 200);
    assert.equal(detailRes.body.usedCount, 1);
    assert.equal(detailRes.body.orders.length, 1);
    assert.equal(detailRes.body.orders[0].orderNumber, orderRes.body.orderNumber);
    assert.equal(detailRes.body.usageHistory.length, 1);
    assert.equal(detailRes.body.usageHistory[0].order.orderNumber, orderRes.body.orderNumber);
    return `code=${p4DiscountCode}, usedCount=${detailRes.body.usedCount}, order=${orderRes.body.orderNumber}`;
  });

  await test('ADMIN-19', 'DELETE /api/discounts/:id deactivates discount (isActive = false)', async () => {
    const delRes = await call(`/api/discounts/${p4DiscountId}`, {
      method: 'DELETE',
      token: admin.token,
    });
    assert.equal(delRes.status, 200);
    assert.equal(delRes.body.isActive, false);

    // Public validate should now return 400 (no longer active)
    const valRes = await call(`/api/discounts/validate/${p4DiscountCode}`);
    assert.equal(valRes.status, 400);
    return `id=${p4DiscountId}, isActive=${delRes.body.isActive}`;
  });

  // =========================================================================
  // Task 4.7: Admin Frontend Pages (FE-24 -> FE-29)
  // =========================================================================
  console.log('\n=== Task 4.7: Admin Frontend Pages ===');

  await test('FE-24', 'Visit /admin renders Dashboard overview (KPIs, Best Sellers, Advanced Analytics) and enforces 403 for non-admin', async () => {
    // Non-admin user cookie should be rejected with 403 by middleware
    const nonAdminRes = await callWeb('/admin', { cookie: customer.cookie });
    assert.equal(nonAdminRes.status, 403, 'Expected 403 when customer visits /admin');

    // Admin visit /admin in English
    const enRes = await callWeb('/admin', { cookie: admin.cookie });
    assert.equal(enRes.status, 200);
    assert.ok(enRes.html.includes('AEVO Control'), 'Expected AEVO Control shell');
    assert.ok(
      enRes.html.includes('Store Performance &amp; Analytics.') ||
        enRes.html.includes('Store Performance & Analytics.'),
      'Expected Dashboard Overview heading'
    );
    assert.ok(enRes.html.includes('Simple Dashboard — Store Overview'));
    assert.ok(enRes.html.includes('Advanced Analytics — Timeframe Comparison'));

    // Admin visit /admin in Vietnamese (aevo_locale=vi)
    const viRes = await callWeb('/admin', {
      cookie: `${admin.cookie}; aevo_locale=vi`,
    });
    assert.equal(viRes.status, 200);
    assert.ok(
      viRes.html.includes('Bảng điều khiển cơ bản — Tổng quan cửa hàng'),
      'Expected Vietnamese Dashboard heading'
    );
    return `en=200, vi=200, nonAdmin=${nonAdminRes.status}`;
  });

  await test('FE-25', 'Visit /admin/products renders Product Management page', async () => {
    const res = await callWeb('/admin/products', { cookie: admin.cookie });
    assert.equal(res.status, 200);
    assert.ok(res.html.includes('Product Management'));
    assert.ok(res.html.includes('Add Product'));
    assert.ok(res.html.includes('data-testid="admin-products-page"'));
    return 'status=200 (/admin/products)';
  });

  await test('FE-26', 'Visit /admin/products/new and /admin/products/[id] renders Create/Edit Product form and creates product via API', async () => {
    const newPage = await callWeb('/admin/products/new', { cookie: admin.cookie });
    assert.equal(newPage.status, 200);
    assert.ok(newPage.html.includes('Create Hardware Product'));
    assert.ok(newPage.html.includes('Variants &amp; Inventory') || newPage.html.includes('Variants & Inventory'));

    // Also verify edit product page /admin/products/[id]
    const editPage = await callWeb(`/admin/products/${createdProductId}`, {
      cookie: admin.cookie,
    });
    assert.equal(editPage.status, 200);
    assert.ok(editPage.html.includes('Edit Hardware Product'));

    // Also verify /admin/discounts page renders properly
    const discountsPage = await callWeb('/admin/discounts', { cookie: admin.cookie });
    assert.equal(discountsPage.status, 200);
    assert.ok(discountsPage.html.includes('Discount Management'));
    return 'status=200 (/admin/products/new, /admin/products/[id], /admin/discounts)';
  });

  await test('FE-27', 'Visit /admin/users renders User Management page', async () => {
    const res = await callWeb('/admin/users', { cookie: admin.cookie });
    assert.equal(res.status, 200);
    assert.ok(res.html.includes('User Management'));
    return 'status=200 (/admin/users)';
  });

  await test('FE-28', 'Visit /admin/orders renders Order Management page with time filter presets', async () => {
    const res = await callWeb('/admin/orders', { cookie: admin.cookie });
    assert.equal(res.status, 200);
    assert.ok(res.html.includes('Order Management'));
    assert.ok(res.html.includes('Today'));
    assert.ok(res.html.includes('Yesterday'));
    assert.ok(res.html.includes('This Week'));
    assert.ok(res.html.includes('This Month'));
    return 'status=200 (/admin/orders)';
  });

  await test('FE-29', 'Visit /admin/orders/[id] renders Order Detail + Status Update form and updates order status', async () => {
    assert.ok(adminTestOrderId, 'Expected adminTestOrderId');
    const detailPage = await callWeb(`/admin/orders/${adminTestOrderId}`, {
      cookie: admin.cookie,
    });
    assert.equal(detailPage.status, 200);
    assert.ok(detailPage.html.includes('data-testid="admin-order-detail-page"'));

    // Perform status transition to SHIPPING and verify
    const statusRes = await call(`/api/orders/${adminTestOrderId}/status`, {
      method: 'PUT',
      token: admin.token,
      body: {
        status: 'SHIPPING',
        note: 'Handed over to express courier via Admin Order Detail',
      },
    });
    assert.equal(statusRes.status, 200);
    assert.equal(statusRes.body.status, 'SHIPPING');
    assert.equal(statusRes.body.statusHistory[0].status, 'SHIPPING');
    return `orderId=${adminTestOrderId}, status=${statusRes.body.status}`;
  });

  await prisma.$disconnect();

  const passed = results.filter((r) => r.ok).length;
  console.log(`\n============================================================`);
  console.log(`${passed}/${results.length} passed`);
  if (passed !== results.length) {
    process.exit(1);
  }
})();
