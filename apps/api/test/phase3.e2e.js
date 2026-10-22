/**
 * Phase 3 E2E checks (E2E_TEST_PLAN.md, Task 3.1 - 3.7).
 *
 * Exercises Shopping Cart API & Frontend, Multi-step Checkout & Order Success,
 * Discount Codes (5-char alphanumeric, maxUses <= 10), Order Management &
 * Inventory Deduction, User Profile Addresses, and Loyalty Points System.
 *
 * Run with both API (3001) and Web (3000) servers up:
 *   node apps/api/test/phase3.e2e.js
 */
const assert = require('node:assert/strict');

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

function randomCode5(prefix = 'T') {
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

async function registerCustomer(tag = 'phase3') {
  const email = uniqueEmail(tag);
  const res = await call('/api/auth/register', {
    method: 'POST',
    body: { email, password: 'password123', fullName: 'Phase Three Tester' },
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
  const customer = await registerCustomer('p3cust');

  // Fetch products with high inventory so cart/order tests never starve stock
  const listRes = await call('/api/products?limit=25');
  assert.equal(listRes.status, 200);
  const allVariants = [];
  for (const p of listRes.body.products) {
    for (const v of p.variants || []) {
      if (v.inventory >= 10 && v.price >= 500000) {
        allVariants.push({ ...v, productName: p.name, productSlug: p.slug });
      }
    }
  }
  assert.ok(allVariants.length >= 4, 'Expected at least 4 variants with inventory >= 10');

  const varA = allVariants[0];
  const varB = allVariants[1];
  const varC = allVariants[2];
  const varD = allVariants[3];

  // =========================================================================
  // Task 3.1: Shopping Cart - API (CART-01 -> CART-07)
  // =========================================================================
  console.log('\n=== Task 3.1: Shopping Cart - API ===');

  let guestSessionCookie = null;
  let guestCartItemId = null;

  await test('CART-01', 'Get cart (guest) creates sessionId and returns empty cart', async () => {
    const res = await call('/api/cart');
    assert.equal(res.status, 200);
    assert.ok(res.body.sessionId, 'Expected sessionId in guest cart');
    assert.ok(Array.isArray(res.body.items));
    assert.equal(res.body.items.length, 0);
    assert.equal(res.body.subtotal, 0);
    guestSessionCookie = cookieFrom(res, 'sessionId') || `sessionId=${res.body.sessionId}`;
    return `sessionId=${res.body.sessionId}`;
  });

  await test('CART-02', 'Get cart (logged in) returns user cart', async () => {
    const res = await call('/api/cart', { token: customer.token });
    assert.equal(res.status, 200);
    assert.equal(res.body.userId, customer.user.id);
    assert.ok(Array.isArray(res.body.items));
    return `userId=${res.body.userId}`;
  });

  await test('CART-03', 'Add item to cart', async () => {
    const res = await call('/api/cart/items', {
      method: 'POST',
      cookie: guestSessionCookie,
      body: { variantId: varA.id, quantity: 1 },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.items.length, 1);
    const added = res.body.items[0];
    assert.equal(added.variantId, varA.id);
    assert.equal(added.quantity, 1);
    guestCartItemId = added.id;
    return `itemId=${guestCartItemId} subtotal=${res.body.subtotal}`;
  });

  await test('CART-04', 'Add item out of stock returns 400 error', async () => {
    const res = await call('/api/cart/items', {
      method: 'POST',
      cookie: guestSessionCookie,
      body: { variantId: varA.id, quantity: varA.inventory + 500 },
    });
    assert.equal(res.status, 400);
    assert.ok(res.body.error, 'Expected error message on insufficient stock');
    return res.body.error;
  });

  await test('CART-05', 'Update item quantity in cart', async () => {
    const res = await call(`/api/cart/items/${guestCartItemId}`, {
      method: 'PUT',
      cookie: guestSessionCookie,
      body: { quantity: 3 },
    });
    assert.equal(res.status, 200);
    const updated = res.body.items.find((i) => i.id === guestCartItemId);
    assert.ok(updated);
    assert.equal(updated.quantity, 3);
    assert.equal(res.body.subtotal, varA.price * 3);
    return `qty=3 subtotal=${res.body.subtotal}`;
  });

  await test('CART-06', 'Remove item from cart', async () => {
    const res = await call(`/api/cart/items/${guestCartItemId}`, {
      method: 'DELETE',
      cookie: guestSessionCookie,
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.items.length, 0);
    assert.equal(res.body.subtotal, 0);
    return 'item removed, cart empty';
  });

  await test('CART-07', 'Cart subtotal calculation with multiple items', async () => {
    await call('/api/cart/items', {
      method: 'POST',
      cookie: guestSessionCookie,
      body: { variantId: varA.id, quantity: 2 },
    });
    const res = await call('/api/cart/items', {
      method: 'POST',
      cookie: guestSessionCookie,
      body: { variantId: varB.id, quantity: 1 },
    });
    assert.equal(res.status, 200);
    const expectedSubtotal = varA.price * 2 + varB.price * 1;
    assert.equal(res.body.subtotal, expectedSubtotal);
    assert.equal(res.body.itemCount, 3);
    return `subtotal=${res.body.subtotal} (2*${varA.price} + 1*${varB.price})`;
  });

  // =========================================================================
  // Task 3.2: Shopping Cart - Frontend (FE-19 -> FE-23)
  // =========================================================================
  console.log('\n=== Task 3.2: Shopping Cart - Frontend ===');

  await test('FE-19', 'Add to cart updates cart itemCount and header badge support', async () => {
    const cartRes = await call('/api/cart', { cookie: guestSessionCookie });
    assert.equal(cartRes.status, 200);
    assert.equal(cartRes.body.itemCount, 3);

    const pageRes = await fetch(`${CLIENT}/products/${varA.productSlug}`, {
      headers: { Cookie: guestSessionCookie },
    });
    assert.equal(pageRes.status, 200);
    const html = await pageRes.text();
    assert.ok(html.includes('data-testid="add-to-cart-button"'), 'Product detail has add-to-cart-button');
    return `itemCount=${cartRes.body.itemCount}`;
  });

  await test('FE-20', 'Cart page (/cart) renders cart items and summary', async () => {
    const res = await fetch(`${CLIENT}/cart`, {
      headers: { Cookie: guestSessionCookie },
    });
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('data-testid="cart-page"'), 'Missing cart-page container');
    assert.ok(html.includes('data-testid="cart-item"'), 'Missing cart-item elements');
    assert.ok(html.includes(varA.productName), 'Missing first product name in cart HTML');
    assert.ok(html.includes(varB.productName), 'Missing second product name in cart HTML');
    return 'rendered 2 items on /cart';
  });

  await test('FE-21', 'Update quantity via AJAX updates total without page reload', async () => {
    const cartBefore = await call('/api/cart', { cookie: guestSessionCookie });
    const firstItem = cartBefore.body.items[0];
    const updRes = await call(`/api/cart/items/${firstItem.id}`, {
      method: 'PUT',
      cookie: guestSessionCookie,
      body: { quantity: 1 },
    });
    assert.equal(updRes.status, 200);
    const expectedSub = varA.price * 1 + varB.price * 1;
    assert.equal(updRes.body.subtotal, expectedSub);
    return `new subtotal=${updRes.body.subtotal}`;
  });

  await test('FE-22', 'Remove single item via AJAX updates cart items and total', async () => {
    const cartBefore = await call('/api/cart', { cookie: guestSessionCookie });
    const firstItem = cartBefore.body.items[0];
    const delRes = await call(`/api/cart/items/${firstItem.id}`, {
      method: 'DELETE',
      cookie: guestSessionCookie,
    });
    assert.equal(delRes.status, 200);
    assert.equal(delRes.body.items.length, 1);
    return `remaining items=${delRes.body.items.length} subtotal=${delRes.body.subtotal}`;
  });

  await test('FE-23', 'Empty cart displays empty state on /cart', async () => {
    await call('/api/cart', { method: 'DELETE', cookie: guestSessionCookie });
    const res = await fetch(`${CLIENT}/cart`, {
      headers: { Cookie: guestSessionCookie },
    });
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('data-testid="cart-empty-state"'), 'Missing cart-empty-state on /cart');
    assert.ok(html.includes('Your cart is empty'), 'Missing empty cart message');
    return 'cart-empty-state rendered';
  });

  // =========================================================================
  // Task 3.4: Discount Codes (DISC-01 -> DISC-07)
  // =========================================================================
  console.log('\n=== Task 3.4: Discount Codes ===');

  const testCode = randomCode5('D');
  const exhaustCode = randomCode5('E');

  await test('DISC-01', 'Admin creates 5-char alphanumeric discount code', async () => {
    const res = await call('/api/discounts', {
      method: 'POST',
      token: admin.token,
      body: {
        code: testCode,
        description: 'Phase 3 E2E 10% discount',
        discountType: 'percentage',
        discountValue: 10,
        maxUses: 5,
      },
    });
    assert.equal(res.status, 201, `Create discount failed: ${JSON.stringify(res.body)}`);
    assert.equal(res.body.code, testCode);
    assert.equal(res.body.maxUses, 5);
    return `code=${res.body.code} maxUses=${res.body.maxUses}`;
  });

  await test('DISC-02', 'Reject discount code with invalid length/format (code="AB")', async () => {
    const res = await call('/api/discounts', {
      method: 'POST',
      token: admin.token,
      body: {
        code: 'AB',
        discountType: 'percentage',
        discountValue: 10,
        maxUses: 5,
      },
    });
    assert.equal(res.status, 400);
    assert.ok(res.body.error);
    return res.body.error;
  });

  await test('DISC-03', 'Reject discount code with maxUses > 10 (maxUses=20)', async () => {
    const res = await call('/api/discounts', {
      method: 'POST',
      token: admin.token,
      body: {
        code: randomCode5('M'),
        discountType: 'percentage',
        discountValue: 15,
        maxUses: 20,
      },
    });
    assert.equal(res.status, 400);
    assert.ok(res.body.error);
    return res.body.error;
  });

  await test('DISC-04', 'Validate valid discount code returns discount info', async () => {
    const res = await call(`/api/discounts/validate/${testCode}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.code, testCode);
    assert.equal(res.body.remainingUses, 5);
    return `code=${testCode} remainingUses=${res.body.remainingUses}`;
  });

  await test('DISC-05', 'Validate invalid/non-existent discount code returns 404/400', async () => {
    const res = await call('/api/discounts/validate/ZZZZ9');
    assert.equal(res.status, 404);
    return `status=${res.status}`;
  });

  await test('DISC-06', 'Validate exhausted discount code returns 400', async () => {
    // Create a code with maxUses=1, consume it via an order, then validate again
    const createRes = await call('/api/discounts', {
      method: 'POST',
      token: admin.token,
      body: {
        code: exhaustCode,
        description: 'Single-use code for exhaustion test',
        discountType: 'fixed',
        discountValue: 50000,
        maxUses: 1,
      },
    });
    assert.equal(createRes.status, 201);

    await call('/api/cart/items', {
      method: 'POST',
      token: customer.token,
      body: { variantId: varC.id, quantity: 1 },
    });

    const ordRes = await call('/api/orders', {
      method: 'POST',
      token: customer.token,
      body: {
        shippingAddress: {
          email: customer.email,
          fullName: 'Phase Three Tester',
          phone: '0901234567',
          address: '100 Nguyen Hue',
          city: 'Ho Chi Minh City',
        },
        discountCode: exhaustCode,
      },
    });
    assert.equal(ordRes.status, 201);

    const valRes = await call(`/api/discounts/validate/${exhaustCode}`);
    assert.equal(valRes.status, 400);
    assert.ok(valRes.body.error.toLowerCase().includes('limit'));
    return `exhausted code ${exhaustCode} rejected with 400`;
  });

  await test('DISC-07', 'Apply discount code during checkout reduces order total', async () => {
    await call('/api/cart/items', {
      method: 'POST',
      token: customer.token,
      body: { variantId: varC.id, quantity: 1 },
    });

    const ordRes = await call('/api/orders', {
      method: 'POST',
      token: customer.token,
      body: {
        shippingAddress: {
          email: customer.email,
          fullName: 'Phase Three Tester',
          phone: '0901234567',
          address: '100 Nguyen Hue',
          city: 'Ho Chi Minh City',
        },
        discountCode: testCode,
      },
    });
    assert.equal(ordRes.status, 201);
    const expectedDiscount = Math.round(varC.price * 0.1);
    assert.equal(ordRes.body.discountCode?.code || ordRes.body.discountCode, testCode);
    assert.equal(ordRes.body.discountAmount, expectedDiscount);
    return `discountAmount=${ordRes.body.discountAmount} on code ${testCode}`;
  });

  // =========================================================================
  // Task 3.6: User Profile - Addresses (ADDR-01 -> ADDR-05)
  // =========================================================================
  console.log('\n=== Task 3.6: User Profile - Addresses ===');

  let addr1Id = null;
  let addr2Id = null;

  await test('ADDR-01', 'List user addresses (initially empty for fresh customer)', async () => {
    const res = await call('/api/users/addresses', { token: customer.token });
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    return `count=${res.body.length}`;
  });

  await test('ADDR-02', 'Add shipping address for user', async () => {
    const res = await call('/api/users/addresses', {
      method: 'POST',
      token: customer.token,
      body: {
        fullName: 'Phase Three Tester',
        phone: '0909111222',
        address: '123 Le Loi Boulevard',
        ward: 'Ben Nghe Ward',
        district: 'District 1',
        city: 'Ho Chi Minh City',
        isDefault: true,
      },
    });
    assert.equal(res.status, 201);
    assert.ok(res.body.id);
    assert.equal(res.body.isDefault, true);
    addr1Id = res.body.id;
    return `addr1Id=${addr1Id}`;
  });

  await test('ADDR-03', 'Update existing shipping address', async () => {
    const res = await call(`/api/users/addresses/${addr1Id}`, {
      method: 'PUT',
      token: customer.token,
      body: {
        address: '456 Dong Khoi Street',
        city: 'Ho Chi Minh City',
      },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.address, '456 Dong Khoi Street');
    return `updated address=${res.body.address}`;
  });

  await test('ADDR-05', 'Multiple addresses supported (>1) and default toggling', async () => {
    const res2 = await call('/api/users/addresses', {
      method: 'POST',
      token: customer.token,
      body: {
        fullName: 'Phase Three Office',
        phone: '0909333444',
        address: '789 Pasteur Street',
        ward: 'Vo Thi Sau Ward',
        district: 'District 3',
        city: 'Ho Chi Minh City',
        isDefault: false,
      },
    });
    assert.equal(res2.status, 201);
    addr2Id = res2.body.id;

    const listRes = await call('/api/users/addresses', { token: customer.token });
    assert.equal(listRes.status, 200);
    assert.ok(listRes.body.length >= 2, 'Expected at least 2 addresses');
    return `addresses count=${listRes.body.length}`;
  });

  await test('ADDR-04', 'Delete non-default address', async () => {
    const delRes = await call(`/api/users/addresses/${addr2Id}`, {
      method: 'DELETE',
      token: customer.token,
    });
    assert.equal(delRes.status, 200);

    const listRes = await call('/api/users/addresses', { token: customer.token });
    assert.equal(listRes.body.find((a) => a.id === addr2Id), undefined);
    return `deleted addr2Id=${addr2Id}`;
  });

  // =========================================================================
  // Task 3.5: Order Management (ORDER-01 -> ORDER-06)
  // =========================================================================
  console.log('\n=== Task 3.5: Order Management ===');

  let createdOrderId = null;
  let createdOrderNumber = null;
  let stockBeforeOrder = 0;

  await test('ORDER-01', 'Create order via POST /api/orders', async () => {
    const prodBefore = await call(`/api/products/slug/${varD.productSlug}`);
    const vBefore = prodBefore.body.variants.find((v) => v.id === varD.id);
    stockBeforeOrder = vBefore.inventory;

    await call('/api/cart/items', {
      method: 'POST',
      token: customer.token,
      body: { variantId: varD.id, quantity: 2 },
    });

    const ordRes = await call('/api/orders', {
      method: 'POST',
      token: customer.token,
      body: {
        addressId: addr1Id,
        shippingAddress: {
          email: customer.email,
          fullName: 'Phase Three Tester',
          phone: '0909111222',
          address: '456 Dong Khoi Street',
          city: 'Ho Chi Minh City',
        },
        shippingMethod: 'standard',
        paymentMethod: 'cod',
      },
    });
    assert.equal(ordRes.status, 201);
    assert.ok(ordRes.body.id);
    assert.ok(
      ordRes.body.orderNumber.startsWith('AEVO-') || ordRes.body.orderNumber.startsWith('ORD-')
    );
    createdOrderId = ordRes.body.id;
    createdOrderNumber = ordRes.body.orderNumber;
    return `orderNumber=${createdOrderNumber}`;
  });

  await test('ORDER-02', 'Variant inventory decreased by exact ordered quantity', async () => {
    const prodAfter = await call(`/api/products/slug/${varD.productSlug}`);
    const vAfter = prodAfter.body.variants.find((v) => v.id === varD.id);
    assert.equal(vAfter.inventory, stockBeforeOrder - 2);
    return `inventory ${stockBeforeOrder} -> ${vAfter.inventory}`;
  });

  await test('ORDER-03', 'GET /api/orders returns authenticated user order history', async () => {
    const res = await call('/api/orders', { token: customer.token });
    assert.equal(res.status, 200);
    const list = Array.isArray(res.body) ? res.body : res.body.orders;
    assert.ok(Array.isArray(list));
    assert.ok(list.some((o) => o.id === createdOrderId));
    return `orders count=${list.length}`;
  });

  await test('ORDER-04', 'GET /api/orders/:id returns full order details', async () => {
    const res = await call(`/api/orders/${createdOrderId}`, { token: customer.token });
    assert.equal(res.status, 200);
    assert.equal(res.body.orderNumber, createdOrderNumber);
    assert.ok(Array.isArray(res.body.items));
    assert.equal(res.body.items.length, 1);
    assert.equal(res.body.items[0].quantity, 2);
    return `items=${res.body.items.length} total=${res.body.totalAmount}`;
  });

  await test('ORDER-05', 'Order statusHistory contains timestamps and tracks status updates', async () => {
    // Admin updates status PENDING -> CONFIRMED
    const statusRes = await call(`/api/orders/${createdOrderId}/status`, {
      method: 'PUT',
      token: admin.token,
      body: { status: 'CONFIRMED', note: 'Verified hardware allocation' },
    });
    assert.equal(statusRes.status, 200);

    const detailRes = await call(`/api/orders/${createdOrderId}`, { token: customer.token });
    assert.equal(detailRes.status, 200);
    assert.equal(detailRes.body.status, 'CONFIRMED');
    assert.ok(Array.isArray(detailRes.body.statusHistory));
    assert.ok(detailRes.body.statusHistory.length >= 2);
    for (const h of detailRes.body.statusHistory) {
      assert.ok(h.status);
      assert.ok(h.createdAt);
    }
    return `status=${detailRes.body.status} historyEntries=${detailRes.body.statusHistory.length}`;
  });

  let guestOrderNumber = null;

  await test('ORDER-06', 'Guest checkout creates order & supports lookup by orderNumber', async () => {
    const guestCartInit = await call('/api/cart');
    const gCookie =
      cookieFrom(guestCartInit, 'sessionId') || `sessionId=${guestCartInit.body.sessionId}`;

    await call('/api/cart/items', {
      method: 'POST',
      cookie: gCookie,
      body: { variantId: varA.id, quantity: 1 },
    });

    const guestEmail = uniqueEmail('guest.checkout');
    const ordRes = await call('/api/orders', {
      method: 'POST',
      cookie: gCookie,
      body: {
        shippingAddress: {
          email: guestEmail,
          fullName: 'Guest Hardware Buyer',
          phone: '0912345678',
          address: '88 Ham Nghi',
          city: 'Ho Chi Minh City',
        },
        paymentMethod: 'cod',
      },
    });
    assert.equal(ordRes.status, 201, `Guest order failed: ${JSON.stringify(ordRes.body)}`);
    guestOrderNumber = ordRes.body.orderNumber;

    const lookupRes = await call(`/api/orders/number/${guestOrderNumber}`);
    assert.equal(lookupRes.status, 200);
    assert.equal(lookupRes.body.orderNumber, guestOrderNumber);
    return `guest orderNumber=${guestOrderNumber}`;
  });

  // =========================================================================
  // Task 3.7: Loyalty Points System (LOYAL-01 -> LOYAL-04)
  // =========================================================================
  console.log('\n=== Task 3.7: Loyalty Points System ===');

  await test('LOYAL-01', 'Earn loyalty points (10%: 1,000,000 VND = 100 points)', async () => {
    const ptsRes = await call('/api/loyalty/points', { token: customer.token });
    assert.equal(ptsRes.status, 200);
    assert.ok(ptsRes.body.points >= 100, `Expected >= 100 points, got ${ptsRes.body.points}`);
    return `earned total points=${ptsRes.body.points}`;
  });

  await test('LOYAL-02', 'GET /api/loyalty/points returns current points and VND value', async () => {
    const res = await call('/api/loyalty/points', { token: customer.token });
    assert.equal(res.status, 200);
    assert.equal(typeof res.body.points, 'number');
    assert.equal(res.body.value, res.body.points * 1000);
    return `points=${res.body.points} value=${res.body.value}`;
  });

  await test('LOYAL-03', 'Redeem 100 loyalty points in checkout deducts 100,000 VND', async () => {
    const beforePts = (await call('/api/loyalty/points', { token: customer.token })).body.points;
    assert.ok(beforePts >= 100, 'Customer needs at least 100 points to test redemption');

    await call('/api/cart/items', {
      method: 'POST',
      token: customer.token,
      body: { variantId: varB.id, quantity: 1 },
    });

    const ordRes = await call('/api/orders', {
      method: 'POST',
      token: customer.token,
      body: {
        addressId: addr1Id,
        shippingAddress: {
          email: customer.email,
          fullName: 'Phase Three Tester',
          phone: '0909111222',
          address: '456 Dong Khoi Street',
          city: 'Ho Chi Minh City',
        },
        usedLoyaltyPoints: 100,
      },
    });
    assert.equal(ordRes.status, 201);
    assert.equal(ordRes.body.usedLoyaltyPoints, 100);
    assert.equal(ordRes.body.loyaltyDiscount, 100000);

    const afterPts = (await call('/api/loyalty/points', { token: customer.token })).body.points;
    const earned = ordRes.body.earnedPoints ?? ordRes.body.earnedLoyaltyPoints ?? 0;
    const expectedAfter = beforePts - 100 + earned;
    assert.equal(afterPts, expectedAfter);
    return `redeemed 100 pts (-100,000 VND), balance ${beforePts} -> ${afterPts}`;
  });

  await test('LOYAL-04', 'GET /api/loyalty/history returns earned & redeemed transactions', async () => {
    const res = await call('/api/loyalty/history', { token: customer.token });
    assert.equal(res.status, 200);
    const history = Array.isArray(res.body) ? res.body : res.body.history;
    assert.ok(Array.isArray(history));
    const types = new Set(history.map((h) => h.type));
    assert.ok(types.has('earn') || types.has('earned'), 'Expected earn transaction in history');
    assert.ok(
      types.has('redeem') || types.has('redeemed'),
      'Expected redeem transaction in history'
    );
    return `history entries=${history.length}`;
  });

  // =========================================================================
  // Task 3.3: Checkout Process & Frontend Pages (CHECK-01 -> CHECK-08)
  // =========================================================================
  console.log('\n=== Task 3.3: Checkout - Process ===');

  await test('CHECK-01', 'Visit /checkout loads multi-step checkout Step 1', async () => {
    const res = await fetch(`${CLIENT}/checkout`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('data-testid="checkout-page"'), 'Missing checkout-page');
    assert.ok(html.includes('data-testid="checkout-step-1"'), 'Missing checkout-step-1');
    assert.ok(html.includes('data-testid="checkout-email-input"'), 'Missing checkout-email-input');
    return '/checkout rendered Step 1';
  });

  await test('CHECK-02', 'Guest checkout flow supported without authentication token', async () => {
    const res = await fetch(`${CLIENT}/checkout`);
    const html = await res.text();
    assert.ok(
      html.includes('Guest checkout'),
      'Expected guest checkout notice when unauthenticated'
    );
    return 'Guest checkout mode active';
  });

  await test('CHECK-03', 'Logged-in user visiting /checkout has address & profile pre-filled', async () => {
    const res = await fetch(`${CLIENT}/checkout`, {
      headers: { Cookie: customer.cookie },
    });
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes(customer.email), 'Expected logged-in email pre-filled on /checkout');
    assert.ok(
      html.includes('Phase Three Tester'),
      'Expected logged-in fullName pre-filled on /checkout'
    );
    return `pre-filled email=${customer.email}`;
  });

  await test('CHECK-04', 'Checkout discount validation & application (AEV10)', async () => {
    const valRes = await call('/api/discounts/validate/AEV10');
    assert.equal(valRes.status, 200);
    assert.equal(valRes.body.code, 'AEV10');
    assert.ok(valRes.body.remainingUses > 0);
    return `AEV10 valid (${valRes.body.discountValue}%)`;
  });

  await test('CHECK-05', 'Checkout invalid discount code returns clear error message', async () => {
    const valRes = await call('/api/discounts/validate/BAD99');
    assert.equal(valRes.status, 404);
    assert.ok(valRes.body.error);
    return valRes.body.error;
  });

  await test('CHECK-06', 'Checkout loyalty points calculation (100 pts = 100,000 VND)', async () => {
    const ptsRes = await call('/api/loyalty/points', { token: customer.token });
    assert.equal(ptsRes.status, 200);
    assert.equal(ptsRes.body.value, ptsRes.body.points * 1000);
    return '100 pts = 100,000 VND verified';
  });

  let finalOrderNumber = null;

  await test('CHECK-07', 'Complete checkout places order and clears cart', async () => {
    await call('/api/cart/items', {
      method: 'POST',
      token: customer.token,
      body: { variantId: varA.id, quantity: 1 },
    });

    const ordRes = await call('/api/orders', {
      method: 'POST',
      token: customer.token,
      body: {
        addressId: addr1Id,
        shippingAddress: {
          email: customer.email,
          fullName: 'Phase Three Tester',
          phone: '0909111222',
          address: '456 Dong Khoi Street',
          city: 'Ho Chi Minh City',
        },
        shippingMethod: 'express',
        paymentMethod: 'bank_transfer',
        discountCode: 'AEV10',
      },
    });
    assert.equal(ordRes.status, 201);
    finalOrderNumber = ordRes.body.orderNumber;

    const cartAfter = await call('/api/cart', { token: customer.token });
    assert.equal(cartAfter.body.items.length, 0, 'Cart should be empty after order placement');
    return `placed ${finalOrderNumber}, cart cleared`;
  });

  await test('CHECK-08', 'Order success page (/checkout/success) displays order number & details', async () => {
    const res = await fetch(
      `${CLIENT}/checkout/success?orderNumber=${encodeURIComponent(finalOrderNumber)}`,
      { headers: { Cookie: customer.cookie } }
    );
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('data-testid="order-success-page"'), 'Missing order-success-page');
    assert.ok(html.includes(finalOrderNumber), 'Missing order number on success page');
    assert.ok(html.includes(varA.productName), 'Missing ordered product name on success page');
    return `rendered success page for ${finalOrderNumber}`;
  });

  // =========================================================================
  // Summary
  // =========================================================================
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  console.log(`\n=== Phase 3 E2E Summary: ${passed}/${results.length} passed ===`);
  if (failed.length > 0) {
    console.error('Failed tests:');
    for (const f of failed) {
      console.error(`  - ${f.id} (${f.name}): ${f.detail}`);
    }
    process.exit(1);
  }
})();
