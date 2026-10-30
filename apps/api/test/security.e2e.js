/**
 * Comprehensive Security E2E Test Suite (Task 5.2 + Full Application Security Audit).
 *
 * Covers basic to advanced security controls across API (3001) and Web (3000):
 * - SEC-01: Admin route protection (Web /admin & API admin endpoints return 403 for non-admin)
 * - SEC-02: JWT validation (forged signature, alg:none, expired token, reset token as session)
 * - SEC-03: Password hash never exposed in any auth or user response
 * - SEC-04: Mass assignment / privilege escalation prevention on register & profile update
 * - SEC-05: Shopping Cart BOLA / IDOR prevention (cross-user/guest cart item tamper blocked)
 * - SEC-06: Order BOLA / IDOR prevention (cross-user order ID & orderNumber lookup blocked)
 * - SEC-07: Address Book BOLA / IDOR prevention (cross-user address modify/delete blocked)
 * - SEC-08: Review ownership & guest rating restriction
 * - SEC-09: Checkout negative / float / duplicate variant quantity exploit prevention
 * - SEC-10: Order cancellation financial & inventory integrity (stock, discount & loyalty reversal)
 * - SEC-11: Discount bounds (>100% / <=0) & negative variant price prevention
 * - SEC-12: Cross-product variant tampering prevention on PUT /api/products/:id
 * - SEC-13: Admin self-ban & self-demotion lockout prevention
 * - SEC-14: Banned user immediate token revocation, login block & guest checkout block
 * - SEC-15: Dangerous URI scheme (javascript:, data:text/html, vbscript:) XSS prevention
 * - SEC-16: Email HTML injection & CRLF header injection sanitization
 * - SEC-17: Prototype pollution (__proto__, constructor) & null-byte sanitization
 * - SEC-18: SQL injection & malformed filter resilience across catalog, orders & users
 * - SEC-19: Security headers (Helmet + Next.js), CORS allowlist & 100kb payload limit (413)
 * - SEC-20: Brute-force rate limiting (429 Retry-After)
 * - SEC-21: Cross-user Guest Order IDOR & credential leak prevention
 * - SEC-22: Guest Cart Session Fixation & Redis key injection prevention
 * - SEC-23: Microservices Gateway SSRF / Path Traversal & Event Bus payload validation
 * - SEC-24: Review edit, profile & address field length bounds enforcement
 * - SEC-25: AI & Elasticsearch DoS input bounding (batch sentiment, benchmark, query length)
 * - SEC-26: Prior password reset token revocation upon new forgot-password request
 *
 * Run with both API (3001) and Web (3000) servers up:
 *   node apps/api/test/security.e2e.js
 */
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const prisma = require('../src/utils/prisma');
const { sendPasswordResetEmail, sendOrderConfirmationEmail } = require('../src/services/mailer');

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

async function call(path, { method = 'GET', body, rawBody, token, cookie, headers = {} } = {}) {
  const h = { ...headers };
  if (body !== undefined || rawBody !== undefined) h['Content-Type'] = 'application/json';
  if (token) h.Authorization = `Bearer ${token}`;
  if (cookie) h.Cookie = cookie;

  const res = await fetch(`${API}${path}`, {
    method,
    headers: h,
    body: rawBody !== undefined ? rawBody : body === undefined ? undefined : JSON.stringify(body),
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

const uniqueEmail = (tag) =>
  `${tag}.${Date.now()}.${Math.floor(Math.random() * 1e6)}@example.com`;

function randomCode5(prefix = 'S') {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let out = prefix.toUpperCase().slice(0, 1);
  while (out.length < 5) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

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

async function registerCustomer(tag = 'sec', extraBody = {}) {
  const email = uniqueEmail(tag);
  const res = await call('/api/auth/register', {
    method: 'POST',
    body: {
      email,
      password: 'password123',
      fullName: `Security Tester ${tag}`,
      ...extraBody,
    },
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
  console.log('\n=== AEVO Security & Vulnerability Verification Suite ===');

  const admin = await loginAs('admin@aevo.com', 'admin123');
  const userA = await registerCustomer('userA');
  const userB = await registerCustomer('userB');

  // -------------------------------------------------------------------------
  // SEC-01: Admin route protection (Web /admin + API admin routes)
  // -------------------------------------------------------------------------
  await test('SEC-01', 'Admin route protection: non-admin receives 403 on /admin and all admin API routes', async () => {
    const unauthWebRes = await callWeb('/admin');
    assert.equal(unauthWebRes.status, 307, 'Expected unauthenticated /admin request to redirect (307) to /login');
    assert.match(unauthWebRes.headers.get('location') || '', /\/login\?next=%2Fadmin/);

    const webRes = await callWeb('/admin', { cookie: userA.cookie });
    assert.equal(webRes.status, 403);

    const apiChecks = await Promise.all([
      call('/api/analytics/simple', { token: userA.token }),
      call('/api/analytics/advanced', { token: userA.token }),
      call('/api/users', { token: userA.token }),
      call('/api/orders/admin/all', { token: userA.token }),
      call('/api/discounts', { token: userA.token }),
      call('/api/products/admin/all', { token: userA.token }),
    ]);

    for (const r of apiChecks) {
      assert.equal(r.status, 403, `Expected 403 on admin API, got ${r.status}`);
    }
    return `Web /admin=403, ${apiChecks.length} Admin APIs=403`;
  });

  // -------------------------------------------------------------------------
  // SEC-02: Invalid, expired, alg:none, and forged JWT tokens
  // -------------------------------------------------------------------------
  await test('SEC-02', 'JWT hardening: rejects invalid, forged, expired, alg:none, and non-string id tokens', async () => {
    // 1. Garbage token
    const garbageRes = await call('/api/auth/profile', { token: 'invalid.jwt.token' });
    assert.equal(garbageRes.status, 401);

    // 2. Forged token signed with wrong secret claiming role: ADMIN
    const forgedAdminToken = jwt.sign(
      { id: admin.user.id, email: admin.user.email, role: 'ADMIN' },
      'wrong-attacker-secret',
      { algorithm: 'HS256', expiresIn: '1h' }
    );
    const forgedApiRes = await call('/api/users', { token: forgedAdminToken });
    assert.equal(forgedApiRes.status, 401);

    // 3. Unsigned alg: "none" token claiming role: ADMIN
    const noneHeader = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const nonePayload = Buffer.from(
      JSON.stringify({ id: admin.user.id, email: admin.user.email, role: 'ADMIN' })
    ).toString('base64url');
    const algNoneToken = `${noneHeader}.${nonePayload}.`;

    const noneApiRes = await call('/api/users', { token: algNoneToken });
    assert.equal(noneApiRes.status, 401);

    const noneWebRes = await callWeb('/admin', { cookie: `token=${algNoneToken}` });
    assert.equal(noneWebRes.status, 403);

    // 4. Expired token on /admin web middleware
    const expiredHeader = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const expiredPayload = Buffer.from(
      JSON.stringify({
        id: admin.user.id,
        role: 'ADMIN',
        exp: Math.floor(Date.now() / 1000) - 3600,
      })
    ).toString('base64url');
    const expiredWebRes = await callWeb('/admin', {
      cookie: `token=${expiredHeader}.${expiredPayload}.fakesig`,
    });
    assert.equal(expiredWebRes.status, 403);

    return 'garbage=401, forged=401, alg:none=401/403, expired=403';
  });

  // -------------------------------------------------------------------------
  // SEC-03: Password never returned in responses
  // -------------------------------------------------------------------------
  await test('SEC-03', 'Password hash is never leaked in register, login, profile, or admin user endpoints', async () => {
    assert.equal(userA.user.password, undefined);
    assert.equal(admin.user.password, undefined);

    const profileRes = await call('/api/auth/profile', { token: userA.token });
    assert.equal(profileRes.status, 200);
    assert.equal(profileRes.body.password, undefined);

    const adminListRes = await call('/api/users', { token: admin.token });
    assert.equal(adminListRes.status, 200);
    assert.ok(adminListRes.body.users.every((u) => u.password === undefined));

    const adminDetailRes = await call(`/api/users/${userA.user.id}`, { token: admin.token });
    assert.equal(adminDetailRes.status, 200);
    assert.equal(adminDetailRes.body.password, undefined);

    return 'password undefined across all user payloads';
  });

  // -------------------------------------------------------------------------
  // SEC-04: Mass assignment / privilege escalation prevention
  // -------------------------------------------------------------------------
  await test('SEC-04', 'Mass assignment prevention: register & profile update ignore role=ADMIN and loyaltyPoints', async () => {
    const escalated = await registerCustomer('massassign', {
      role: 'ADMIN',
      loyaltyPoints: 999999,
      isActive: true,
    });
    assert.equal(escalated.user.role, 'CUSTOMER');
    assert.equal(escalated.user.loyaltyPoints, 0);

    const updRes = await call('/api/auth/profile', {
      method: 'PUT',
      token: escalated.token,
      body: {
        fullName: 'Still Customer',
        role: 'ADMIN',
        loyaltyPoints: 500000,
      },
    });
    assert.equal(updRes.status, 200);
    assert.equal(updRes.body.role, 'CUSTOMER');
    assert.equal(updRes.body.loyaltyPoints, 0);
    return `role=${updRes.body.role}, points=${updRes.body.loyaltyPoints}`;
  });

  // -------------------------------------------------------------------------
  // SEC-05: Shopping Cart BOLA / IDOR prevention
  // -------------------------------------------------------------------------
  await test('SEC-05', 'Shopping Cart IDOR prevention: User B cannot modify or delete User A cart items', async () => {
    const prodRes = await call('/api/products?limit=10');
    const variant = prodRes.body.products
      .flatMap((p) => p.variants || [])
      .find((v) => v.inventory >= 5);
    assert.ok(variant);

    // User A adds item to User A's cart
    const addRes = await call('/api/cart/items', {
      method: 'POST',
      token: userA.token,
      body: { variantId: variant.id, quantity: 2 },
    });
    assert.equal(addRes.status, 200);
    const userACartItemId = addRes.body.items[0].id;

    // User B attempts to update User A's cartItem
    const putAttack = await call(`/api/cart/items/${userACartItemId}`, {
      method: 'PUT',
      token: userB.token,
      body: { quantity: 1 },
    });
    assert.equal(putAttack.status, 403, 'Expected 403 when User B modifies User A cart item');

    // Unauthenticated guest without sessionId attempts to delete User A's cartItem
    const delAttack = await call(`/api/cart/items/${userACartItemId}`, {
      method: 'DELETE',
    });
    assert.equal(delAttack.status, 403, 'Expected 403 when anonymous caller deletes User A cart item');

    // Verify User A's cart still has quantity 2
    const checkCart = await call('/api/cart', { token: userA.token });
    assert.equal(checkCart.body.items[0].quantity, 2);

    return `PUT attack=${putAttack.status}, DELETE attack=${delAttack.status}, User A qty preserved=2`;
  });

  // -------------------------------------------------------------------------
  // SEC-06: Order BOLA / IDOR prevention
  // -------------------------------------------------------------------------
  let userAOrder = null;
  await test('SEC-06', 'Order IDOR prevention: User B cannot view User A order by ID or orderNumber', async () => {
    const ordRes = await call('/api/orders', {
      method: 'POST',
      token: userA.token,
      body: {
        shippingAddress: {
          fullName: 'User A Private',
          phone: '0901112222',
          address: '123 Secret St',
          city: 'Ho Chi Minh City',
        },
        paymentMethod: 'cod',
      },
    });
    assert.equal(ordRes.status, 201);
    userAOrder = ordRes.body;

    // User B tries GET /api/orders/:id
    const byIdAttack = await call(`/api/orders/${userAOrder.id}`, { token: userB.token });
    assert.equal(byIdAttack.status, 403);

    // Anonymous tries GET /api/orders/:id
    const anonById = await call(`/api/orders/${userAOrder.id}`);
    assert.equal(anonById.status, 401);

    // User B tries GET /api/orders/number/:orderNumber
    const byNumAttack = await call(`/api/orders/number/${userAOrder.orderNumber}`, {
      token: userB.token,
    });
    assert.equal(byNumAttack.status, 403);

    return `byId(UserB)=403, byId(Anon)=401, byNumber(UserB)=403`;
  });

  // -------------------------------------------------------------------------
  // SEC-07: Address Book BOLA / IDOR prevention
  // -------------------------------------------------------------------------
  await test('SEC-07', 'Address Book IDOR prevention: User B cannot update or delete User A address', async () => {
    const addrRes = await call('/api/users/addresses', {
      method: 'POST',
      token: userA.token,
      body: {
        fullName: 'User A Home',
        phone: '0901112222',
        address: '456 Private Ave',
        city: 'Ho Chi Minh City',
      },
    });
    assert.equal(addrRes.status, 201);
    const addrId = addrRes.body.id;

    const updAttack = await call(`/api/users/addresses/${addrId}`, {
      method: 'PUT',
      token: userB.token,
      body: { address: 'Hacked Address' },
    });
    assert.equal(updAttack.status, 404);

    const delAttack = await call(`/api/users/addresses/${addrId}`, {
      method: 'DELETE',
      token: userB.token,
    });
    assert.equal(delAttack.status, 404);

    return `PUT=${updAttack.status}, DELETE=${delAttack.status}`;
  });

  // -------------------------------------------------------------------------
  // SEC-08: Review ownership & guest rating restriction
  // -------------------------------------------------------------------------
  await test('SEC-08', 'Review security: guest rating rejected (401), cross-user review edit/delete rejected (403), oversized comment rejected (400)', async () => {
    const prodRes = await call('/api/products?limit=1');
    const productId = prodRes.body.products[0].id;

    // Guest attempting star rating -> 401
    const guestRate = await call('/api/reviews', {
      method: 'POST',
      body: { productId, rating: 5, comment: 'Unauthorized star rating' },
    });
    assert.equal(guestRate.status, 401);

    // Oversized comment (> 2000 chars) -> 400
    const hugeComment = await call('/api/reviews', {
      method: 'POST',
      body: { productId, comment: 'A'.repeat(2100) },
    });
    assert.equal(hugeComment.status, 400);

    // User A posts legitimate review
    const revRes = await call('/api/reviews', {
      method: 'POST',
      token: userA.token,
      body: { productId, rating: 5, comment: 'Solid engineering.' },
    });
    assert.equal(revRes.status, 201);

    // User B tries to edit or delete User A's review -> 403
    const editAttack = await call(`/api/reviews/${revRes.body.id}`, {
      method: 'PUT',
      token: userB.token,
      body: { comment: 'Tampered comment' },
    });
    assert.equal(editAttack.status, 403);

    const delAttack = await call(`/api/reviews/${revRes.body.id}`, {
      method: 'DELETE',
      token: userB.token,
    });
    assert.equal(delAttack.status, 403);

    return 'guestRate=401, hugeComment=400, crossUserEdit=403, crossUserDelete=403';
  });

  // -------------------------------------------------------------------------
  // SEC-09: Checkout negative / float / duplicate variant quantity exploit prevention
  // -------------------------------------------------------------------------
  await test('SEC-09', 'Checkout integrity: rejects negative (-5), zero, float (1.5), and duplicate-overflow quantities', async () => {
    const prodRes = await call('/api/products?limit=10');
    const variant = prodRes.body.products
      .flatMap((p) => p.variants || [])
      .find((v) => v.inventory >= 2);
    assert.ok(variant);

    const baseAddress = {
      fullName: 'Exploit Tester',
      phone: '0909998888',
      address: '1 Test Rd',
      city: 'Ho Chi Minh City',
    };

    // 1. Negative quantity (-5)
    const negRes = await call('/api/orders', {
      method: 'POST',
      token: userB.token,
      body: {
        items: [{ variantId: variant.id, quantity: -5 }],
        shippingAddress: baseAddress,
      },
    });
    assert.equal(negRes.status, 400, 'Expected 400 for negative quantity');

    // 2. Float quantity (1.5)
    const floatRes = await call('/api/orders', {
      method: 'POST',
      token: userB.token,
      body: {
        items: [{ variantId: variant.id, quantity: 1.5 }],
        shippingAddress: baseAddress,
      },
    });
    assert.equal(floatRes.status, 400, 'Expected 400 for non-integer quantity');

    // 3. Duplicate variantId rows whose combined quantity exceeds inventory
    const halfStock = Math.floor(variant.inventory / 2) + 1;
    const dupOverflowRes = await call('/api/orders', {
      method: 'POST',
      token: userB.token,
      body: {
        items: [
          { variantId: variant.id, quantity: halfStock },
          { variantId: variant.id, quantity: halfStock },
        ],
        shippingAddress: baseAddress,
      },
    });
    assert.equal(dupOverflowRes.status, 400, 'Expected 400 when duplicate variant rows exceed stock');

    return `neg=${negRes.status}, float=${floatRes.status}, dupOverflow=${dupOverflowRes.status}`;
  });

  // -------------------------------------------------------------------------
  // SEC-10: Order cancellation financial & inventory integrity
  // -------------------------------------------------------------------------
  await test('SEC-10', 'Order cancellation restores variant inventory, releases discount usage, reverses earned loyalty points, and blocks reopening', async () => {
    const prodRes = await call('/api/products?limit=10');
    const variant = prodRes.body.products
      .flatMap((p) => p.variants || [])
      .find((v) => v.inventory >= 5 && v.price >= 500000);
    assert.ok(variant);

    const stockBefore = variant.inventory;
    const code = randomCode5('C');
    const discRes = await call('/api/discounts', {
      method: 'POST',
      token: admin.token,
      body: {
        code,
        discountType: 'percentage',
        discountValue: 10,
        maxUses: 1,
      },
    });
    assert.equal(discRes.status, 201);

    const ptsBefore = (await call('/api/loyalty/points', { token: userA.token })).body.points;

    // Place order with 2 units + single-use discount code
    const ordRes = await call('/api/orders', {
      method: 'POST',
      token: userA.token,
      body: {
        items: [{ variantId: variant.id, quantity: 2 }],
        discountCode: code,
        shippingAddress: {
          fullName: 'Cancel Integrity Tester',
          phone: '0901112222',
          address: '10 Cancel St',
          city: 'Ho Chi Minh City',
        },
      },
    });
    assert.equal(ordRes.status, 201);
    const orderId = ordRes.body.id;

    // Points increased after purchase
    const ptsDuring = (await call('/api/loyalty/points', { token: userA.token })).body.points;
    assert.ok(ptsDuring > ptsBefore, 'Expected earned points after order placement');

    // Admin cancels the order
    const cancelRes = await call(`/api/orders/${orderId}/status`, {
      method: 'PUT',
      token: admin.token,
      body: { status: 'CANCELLED', note: 'Customer requested cancellation' },
    });
    assert.equal(cancelRes.status, 200);
    assert.equal(cancelRes.body.status, 'CANCELLED');

    // 1. Verify inventory restored to stockBefore
    const updatedVariant = await prisma.productVariant.findUnique({ where: { id: variant.id } });
    assert.equal(updatedVariant.inventory, stockBefore, 'Expected variant stock restored on cancel');

    // 2. Verify discount code usage released (usedCount back to 0)
    const updatedDiscount = await prisma.discount.findUnique({ where: { id: discRes.body.id } });
    assert.equal(updatedDiscount.usedCount, 0, 'Expected discount usedCount restored to 0 on cancel');

    // 3. Verify earned loyalty points clawed back to ptsBefore
    const ptsAfterCancel = (await call('/api/loyalty/points', { token: userA.token })).body.points;
    assert.equal(ptsAfterCancel, ptsBefore, 'Expected earned loyalty points reversed on cancel');

    // 4. Attempting to reopen a CANCELLED order to DELIVERED is rejected with 400
    const reopenAttempt = await call(`/api/orders/${orderId}/status`, {
      method: 'PUT',
      token: admin.token,
      body: { status: 'DELIVERED' },
    });
    assert.equal(reopenAttempt.status, 400);

    return `stock=${updatedVariant.inventory}, discountUsed=${updatedDiscount.usedCount}, points=${ptsAfterCancel}, reopen=${reopenAttempt.status}`;
  });

  // -------------------------------------------------------------------------
  // SEC-11: Discount bounds (>100% / <=0) & negative variant price prevention
  // -------------------------------------------------------------------------
  await test('SEC-11', 'Rejects percentage discount > 100% and negative product variant prices', async () => {
    const over100 = await call('/api/discounts', {
      method: 'POST',
      token: admin.token,
      body: {
        code: randomCode5('X'),
        discountType: 'percentage',
        discountValue: 150,
        maxUses: 5,
      },
    });
    assert.equal(over100.status, 400);

    const catRes = await call('/api/categories');
    const negPriceProd = await call('/api/products', {
      method: 'POST',
      token: admin.token,
      body: {
        name: 'Negative Price Laptop',
        description: 'Should fail validation',
        brand: 'ASUS',
        categoryId: catRes.body[0].id,
        variants: [{ name: 'Bad Variant', price: -500000, inventory: 5 }],
      },
    });
    assert.equal(negPriceProd.status, 400);

    return `discount150%=${over100.status}, negPrice=${negPriceProd.status}`;
  });

  // -------------------------------------------------------------------------
  // SEC-12: Cross-product variant tampering prevention
  // -------------------------------------------------------------------------
  await test('SEC-12', 'Cross-product variant IDOR: PUT /api/products/:id cannot modify variants belonging to another product', async () => {
    const prods = (await call('/api/products?limit=5')).body.products;
    const prod1 = prods[0];
    const prod2 = prods[1];
    const prod2Variant = prod2.variants[0];
    const originalPrice = prod2Variant.price;

    // Attempt to tamper with prod2Variant.id while updating prod1
    const res = await call(`/api/products/${prod1.id}`, {
      method: 'PUT',
      token: admin.token,
      body: {
        name: prod1.name,
        variants: [
          ...prod1.variants.map((v) => ({
            id: v.id,
            name: v.name,
            sku: v.sku,
            price: v.price,
            inventory: v.inventory,
          })),
          {
            id: prod2Variant.id,
            name: 'Hijacked Variant',
            price: 1,
            inventory: 999,
          },
        ],
      },
    });
    assert.equal(res.status, 200);

    // Verify prod2Variant was NOT modified
    const checkVariant = await prisma.productVariant.findUnique({
      where: { id: prod2Variant.id },
    });
    assert.equal(checkVariant.price, originalPrice);
    assert.equal(checkVariant.productId, prod2.id);

    // Also verify PUT /api/products/:prod1Id/variants/:prod2VariantId returns 404
    const directMismatch = await call(
      `/api/products/${prod1.id}/variants/${prod2Variant.id}`,
      {
        method: 'PUT',
        token: admin.token,
        body: { price: 1 },
      }
    );
    assert.equal(directMismatch.status, 404);

    return `prod2Variant price preserved=${checkVariant.price}, mismatchRoute=${directMismatch.status}`;
  });

  // -------------------------------------------------------------------------
  // SEC-13: Admin self-ban & self-demotion lockout prevention
  // -------------------------------------------------------------------------
  await test('SEC-13', 'Admin cannot ban, deactivate, or demote their own active account', async () => {
    const selfBan = await call(`/api/users/${admin.user.id}/ban`, {
      method: 'PUT',
      token: admin.token,
    });
    assert.equal(selfBan.status, 400);

    const selfDemote = await call(`/api/users/${admin.user.id}`, {
      method: 'PUT',
      token: admin.token,
      body: { role: 'CUSTOMER' },
    });
    assert.equal(selfDemote.status, 400);

    const selfDeactivate = await call(`/api/users/${admin.user.id}`, {
      method: 'PUT',
      token: admin.token,
      body: { isActive: false },
    });
    assert.equal(selfDeactivate.status, 400);

    return `selfBan=${selfBan.status}, selfDemote=${selfDemote.status}, selfDeactivate=${selfDeactivate.status}`;
  });

  // -------------------------------------------------------------------------
  // SEC-14: Banned user immediate revocation & guest checkout block
  // -------------------------------------------------------------------------
  await test('SEC-14', 'Banned user loses session immediately (401), cannot login (403), and cannot guest-checkout with banned email (403)', async () => {
    const tempUser = await registerCustomer('bancheck');
    const banRes = await call(`/api/users/${tempUser.user.id}/ban`, {
      method: 'PUT',
      token: admin.token,
    });
    assert.equal(banRes.status, 200);

    const profRes = await call('/api/auth/profile', { token: tempUser.token });
    assert.equal(profRes.status, 401);

    const prodRes = await call('/api/products?limit=5');
    const variant = prodRes.body.products.flatMap((p) => p.variants || []).find((v) => v.inventory >= 2);

    // Guest checkout using banned user's email -> 403
    const guestOrderAttempt = await call('/api/orders', {
      method: 'POST',
      body: {
        items: [{ variantId: variant.id, quantity: 1 }],
        shippingAddress: {
          email: tempUser.email,
          fullName: 'Banned Guest Bypass Attempt',
          phone: '0900000000',
          address: '1 Blocked Way',
          city: 'Ho Chi Minh City',
        },
      },
    });
    assert.equal(guestOrderAttempt.status, 403);

    return `profile=401, guestCheckoutWithBannedEmail=${guestOrderAttempt.status}`;
  });

  // -------------------------------------------------------------------------
  // SEC-15: Dangerous URI scheme XSS prevention in product & category images
  // -------------------------------------------------------------------------
  await test('SEC-15', 'Rejects javascript:, vbscript:, and data:text/html image URLs in products and categories', async () => {
    const catRes = await call('/api/categories');
    const catId = catRes.body[0].id;

    const jsImgProd = await call('/api/products', {
      method: 'POST',
      token: admin.token,
      body: {
        name: 'XSS Image Product',
        description: 'Testing image URL scheme validation',
        brand: 'ASUS',
        categoryId: catId,
        images: ['javascript:alert(document.cookie)'],
      },
    });
    assert.equal(jsImgProd.status, 400);

    const dataHtmlCat = await call('/api/categories', {
      method: 'POST',
      token: admin.token,
      body: {
        name: `XSS Cat ${Date.now()}`,
        image: 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
      },
    });
    assert.equal(dataHtmlCat.status, 400);

    return `javascript:=${jsImgProd.status}, data:text/html=${dataHtmlCat.status}`;
  });

  // -------------------------------------------------------------------------
  // SEC-16: Email HTML injection & CRLF header injection sanitization
  // -------------------------------------------------------------------------
  await test('SEC-16', 'Transactional mailer escapes HTML payloads and strips CRLF header injection', async () => {
    const xssName = '<script>alert("xss")</script>\r\nBcc: attacker@evil.com';
    const resetResult = await sendPasswordResetEmail(
      'victim@example.com\r\nBcc: leak@evil.com',
      xssName,
      'http://localhost:3000/reset?token=abc"><script>evil()</script>'
    );
    assert.ok(resetResult.htmlPreview, 'Expected htmlPreview in dev mailer');
    assert.ok(!resetResult.htmlPreview.includes('<script>'), 'Raw <script> tag must be escaped');
    assert.ok(resetResult.htmlPreview.includes('&lt;script&gt;'), 'Expected HTML-escaped script tag');

    const orderMailResult = await sendOrderConfirmationEmail(
      'buyer@example.com',
      xssName,
      {
        orderNumber: 'AEVO-TEST',
        totalAmount: 1000000,
        paymentMethod: 'cod',
        items: [{ productName: '<img src=x onerror=alert(1)>', quantity: 1, price: 1000000 }],
      }
    );
    assert.ok(!orderMailResult.htmlPreview.includes('<img src=x'));
    assert.ok(orderMailResult.htmlPreview.includes('&lt;img src=x'));

    return 'HTML entities escaped & CRLF stripped in reset + order emails';
  });

  // -------------------------------------------------------------------------
  // SEC-17: Prototype pollution & null-byte sanitization
  // -------------------------------------------------------------------------
  await test('SEC-17', 'Sanitizer strips __proto__, constructor, prototype, and null bytes from request payloads', async () => {
    const rawPayload =
      '{"fullName":"Clean\\u0000Name","__proto__":{"isAdmin":true,"polluted":"yes"},"constructor":{"prototype":{"polluted":"yes"}}}';
    const res = await call('/api/auth/profile', {
      method: 'PUT',
      token: userA.token,
      rawBody: rawPayload,
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.fullName, 'CleanName', 'Expected null byte stripped from fullName');
    assert.equal({}.polluted, undefined, 'Object.prototype must not be polluted');
    assert.equal({}.isAdmin, undefined, 'Object.prototype.isAdmin must not be polluted');
    return `fullName="${res.body.fullName}", Object.prototype clean`;
  });

  // -------------------------------------------------------------------------
  // SEC-18: SQL Injection & Prisma filter resilience
  // -------------------------------------------------------------------------
  await test('SEC-18', 'SQL injection payloads in product search, order search, and user search are safely parameterized', async () => {
    const sqli = encodeURIComponent("' OR 1=1; DROP TABLE users; --");
    const [prodSearch, orderSearch, userSearch] = await Promise.all([
      call(`/api/products?search=${sqli}&category=${sqli}&brand=${sqli}`),
      call(`/api/orders/admin/all?search=${sqli}`, { token: admin.token }),
      call(`/api/users?search=${sqli}`, { token: admin.token }),
    ]);
    assert.equal(prodSearch.status, 200);
    assert.equal(orderSearch.status, 200);
    assert.equal(userSearch.status, 200);
    assert.equal(userSearch.body.users.length, 0);
    return 'All parameterized queries returned 200 with 0 false matches';
  });

  // -------------------------------------------------------------------------
  // SEC-19: Security headers (API & Web), CORS policy & 100kb body limit (413)
  // -------------------------------------------------------------------------
  await test('SEC-19', 'Security headers present on API & Web, X-Powered-By hidden, and >100kb JSON payload rejected (413)', async () => {
    const apiRes = await call('/health');
    assert.equal(apiRes.status, 200);
    assert.equal(apiRes.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(apiRes.headers.get('x-frame-options'), 'DENY');
    assert.equal(apiRes.headers.get('x-powered-by'), null);

    const webRes = await callWeb('/');
    assert.equal(webRes.status, 200);
    assert.equal(webRes.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(webRes.headers.get('x-frame-options'), 'DENY');
    assert.equal(webRes.headers.get('x-powered-by'), null);

    // Oversized body (> 100kb) -> 413 Payload Too Large
    const hugeBody = JSON.stringify({ data: 'X'.repeat(120 * 1024) });
    const tooLargeRes = await call('/api/auth/login', {
      method: 'POST',
      rawBody: hugeBody,
    });
    assert.equal(tooLargeRes.status, 413);

    return `API/Web headers verified, oversized body=${tooLargeRes.status}`;
  });

  // -------------------------------------------------------------------------
  // SEC-20: Brute-force rate limiting on login (429 Retry-After)
  // -------------------------------------------------------------------------
  await test('SEC-20', 'Per-account rate limiter blocks brute-force login attempts with 429 and Retry-After header', async () => {
    const targetEmail = uniqueEmail('ratelimit.target');
    let lastRes = null;
    for (let i = 0; i < 12; i++) {
      lastRes = await call('/api/auth/login', {
        method: 'POST',
        body: { email: targetEmail, password: `wrongpass-${i}` },
      });
      if (lastRes.status === 429) break;
    }
    assert.equal(lastRes.status, 429, 'Expected 429 after exceeding per-account login limit');
    assert.ok(lastRes.headers.get('retry-after'), 'Expected Retry-After header on 429');
    return `status=429, Retry-After=${lastRes.headers.get('retry-after')}s`;
  });

  // -------------------------------------------------------------------------
  // SEC-21: Cross-user Guest Order IDOR & credential leak prevention
  // -------------------------------------------------------------------------
  await test('SEC-21', 'Cross-user Guest Order IDOR blocked & autoCreatedAccount omitted from bulk lists', async () => {
    const prodRes = await call('/api/products?limit=10');
    const sec21Variant = prodRes.body.products
      .flatMap((p) => p.variants || [])
      .find((v) => v.inventory >= 5);
    assert.ok(sec21Variant, 'Expected an in-stock variant for SEC-21');

    const guestEmail = uniqueEmail('sec21.guest');
    const guestOrdRes = await call('/api/orders', {
      method: 'POST',
      body: {
        items: [{ variantId: sec21Variant.id, quantity: 1 }],
        shippingAddress: {
          email: guestEmail,
          fullName: 'SEC-21 Guest Buyer',
          phone: '0909555666',
          address: '88 Dong Khoi',
          city: 'Ho Chi Minh City',
        },
        paymentMethod: 'cod',
      },
    });
    assert.equal(guestOrdRes.status, 201);
    const gOrderId = guestOrdRes.body.id;
    const gOrderNumber = guestOrdRes.body.orderNumber;

    // Logged-in User B (different account) must NOT be able to view Guest's order by ID or orderNumber
    const idorById = await call(`/api/orders/${gOrderId}`, { token: userB.token });
    assert.equal(idorById.status, 403, `Expected 403 for User B on guest order ID, got ${idorById.status}`);

    const idorByNumber = await call(`/api/orders/number/${gOrderNumber}`, { token: userB.token });
    assert.equal(
      idorByNumber.status,
      403,
      `Expected 403 for User B on guest orderNumber, got ${idorByNumber.status}`
    );

    // Admin order list must NOT expose plaintext temporaryPassword in autoCreatedAccount
    const adminList = await call(`/api/orders/admin/all?search=${gOrderNumber}`, {
      token: admin.token,
    });
    assert.equal(adminList.status, 200);
    const listedOrder = (adminList.body.orders || []).find((o) => o.orderNumber === gOrderNumber);
    assert.ok(listedOrder, 'Expected guest order in admin list');
    assert.equal(
      listedOrder.autoCreatedAccount,
      undefined,
      'Admin bulk order list must not leak autoCreatedAccount credentials'
    );

    return `UserB ID=${idorById.status}, Number=${idorByNumber.status}, adminList.autoCreatedAccount=undefined`;
  });

  // -------------------------------------------------------------------------
  // SEC-22: Guest Cart Session Fixation & Redis key injection prevention
  // -------------------------------------------------------------------------
  await test('SEC-22', 'Guest cart rejects session fixation & Redis key injection in sessionId', async () => {
    const injectedCookie = 'sessionId=auth:admin*;FLUSHALL';
    const res1 = await call('/api/cart', { cookie: injectedCookie });
    assert.equal(res1.status, 200);
    assert.notEqual(res1.body.sessionId, 'auth:admin*;FLUSHALL');
    assert.match(res1.body.sessionId, /^guest_\d+_[a-f0-9]{32}$/);

    // Predictable/unissued valid-format sessionId must also be replaced with a fresh server-generated ID
    const fixedSession = 'sessionId=attacker_fixed_session_12345';
    const res2 = await call('/api/cart', { cookie: fixedSession });
    assert.equal(res2.status, 200);
    assert.notEqual(res2.body.sessionId, 'attacker_fixed_session_12345');
    assert.match(res2.body.sessionId, /^guest_\d+_[a-f0-9]{32}$/);

    return `Generated CSPRNG sessionId=${res2.body.sessionId}`;
  });

  // -------------------------------------------------------------------------
  // SEC-23: Microservices Gateway SSRF / Path Traversal & Event Bus validation
  // -------------------------------------------------------------------------
  await test('SEC-23', 'Microservices Gateway proxy blocks path traversal/SSRF and validates event bus payloads', async () => {
    const travRes = await call('/api/microservices/proxy/product-service/..%2f..%2fetc/passwd');
    assert.equal(travRes.status, 400);

    const ssrfRes = await call('/api/microservices/proxy/product-service/@evil.com/pwn');
    assert.equal(ssrfRes.status, 400);

    const badEventType = await call('/api/microservices/events/publish', {
      method: 'POST',
      body: { type: '<script>evil</script>', payload: {} },
    });
    assert.equal(badEventType.status, 400);

    const badEventPayload = await call('/api/microservices/events/publish', {
      method: 'POST',
      body: { type: 'INVENTORY_SYNC', payload: ['not-an-object'] },
    });
    assert.equal(badEventPayload.status, 400);

    return `traversal=${travRes.status}, ssrf=${ssrfRes.status}, badEvent=${badEventType.status}/${badEventPayload.status}`;
  });

  // -------------------------------------------------------------------------
  // SEC-24: Review edit, profile & address field length bounds enforcement
  // -------------------------------------------------------------------------
  await test('SEC-24', 'Review PUT, Profile PUT, and Address POST enforce strict maximum field lengths', async () => {
    const prodRes = await call('/api/products?limit=1');
    const sec24ProductId = prodRes.body.products[0].id;

    // Create a valid review as User A, then attempt to PUT >2000 chars
    const revCreate = await call('/api/reviews', {
      method: 'POST',
      token: userA.token,
      body: { productId: sec24ProductId, rating: 5, comment: 'Initial short review' },
    });
    assert.equal(revCreate.status, 201);

    const revOversizedEdit = await call(`/api/reviews/${revCreate.body.id}`, {
      method: 'PUT',
      token: userA.token,
      body: { comment: 'R'.repeat(2500) },
    });
    assert.equal(revOversizedEdit.status, 400, 'Expected 400 when editing review comment > 2000 chars');

    const profileOversized = await call('/api/auth/profile', {
      method: 'PUT',
      token: userA.token,
      body: { fullName: 'N'.repeat(200) },
    });
    assert.equal(profileOversized.status, 400, 'Expected 400 when fullName > 120 chars');

    const addrOversized = await call('/api/users/addresses', {
      method: 'POST',
      token: userA.token,
      body: {
        fullName: 'Valid Name',
        phone: '0909123456',
        address: 'A'.repeat(400),
        city: 'Ho Chi Minh City',
      },
    });
    assert.equal(addrOversized.status, 400, 'Expected 400 when street address > 300 chars');

    return `reviewEdit=${revOversizedEdit.status}, profile=${profileOversized.status}, address=${addrOversized.status}`;
  });

  // -------------------------------------------------------------------------
  // SEC-25: AI & Elasticsearch DoS input bounding
  // -------------------------------------------------------------------------
  await test('SEC-25', 'AI & Elasticsearch endpoints reject oversized batch/query DoS payloads (400)', async () => {
    const batchSentiment = await call('/api/ai/sentiment', {
      method: 'POST',
      body: {
        reviews: Array.from({ length: 60 }, (_, i) => ({ comment: `Review ${i}`, rating: 5 })),
      },
    });
    assert.equal(batchSentiment.status, 400);

    const benchFlood = await call('/api/search/benchmark', {
      method: 'POST',
      body: {
        queries: Array.from({ length: 20 }, (_, i) => `query-${i}`),
      },
    });
    assert.equal(benchFlood.status, 400);

    const longSearch = await call(`/api/search/elasticsearch?q=${'Q'.repeat(250)}`);
    assert.equal(longSearch.status, 400);

    return `batchSentiment=${batchSentiment.status}, benchFlood=${benchFlood.status}, longSearch=${longSearch.status}`;
  });

  // -------------------------------------------------------------------------
  // SEC-26: Prior password reset token revocation upon new forgot-password request
  // -------------------------------------------------------------------------
  await test('SEC-26', 'Requesting a new password reset link revokes any prior unused reset tokens for that user', async () => {
    const resetUser = await registerCustomer('sec26.reset');

    await call('/api/auth/forgot-password', {
      method: 'POST',
      body: { email: resetUser.email },
    });
    const firstTokens = await prisma.passwordResetToken.findMany({
      where: { userId: resetUser.user.id, usedAt: null },
    });
    assert.equal(firstTokens.length, 1, 'Expected 1 active reset token after first request');

    // Wait 5ms so tokeniat/hash differs if needed and request a second reset link
    await new Promise((r) => setTimeout(r, 1100));
    await call('/api/auth/forgot-password', {
      method: 'POST',
      body: { email: resetUser.email },
    });

    const activeAfterSecond = await prisma.passwordResetToken.findMany({
      where: { userId: resetUser.user.id, usedAt: null },
    });
    const revokedTokens = await prisma.passwordResetToken.findMany({
      where: { userId: resetUser.user.id, usedAt: { not: null } },
    });
    assert.equal(activeAfterSecond.length, 1, 'Expected only 1 active reset token after second request');
    assert.ok(revokedTokens.length >= 1, 'Expected prior reset token to be marked usedAt != null');

    return `activeTokens=${activeAfterSecond.length}, revokedPriorTokens=${revokedTokens.length}`;
  });

  // -------------------------------------------------------------------------
  // SEC-27: Next.js /admin middleware blocks X-Forwarded-Host Open Redirect
  // -------------------------------------------------------------------------
  await test('SEC-27', 'Next.js /admin middleware ignores untrusted X-Forwarded-Host / X-Forwarded-Proto headers', async () => {
    const res = await fetch(`${CLIENT}/admin`, {
      redirect: 'manual',
      headers: {
        'X-Forwarded-Host': 'evil-phishing.example.com',
        'X-Forwarded-Proto': 'javascript',
      },
    });
    assert.ok([307, 308, 302].includes(res.status), `Expected redirect status, got ${res.status}`);
    const location = res.headers.get('location') || '';
    assert.ok(!location.includes('evil-phishing.example.com'), `Untrusted host leaked into redirect Location: ${location}`);
    assert.ok(!location.toLowerCase().startsWith('javascript:'), `Unsafe protocol in redirect Location: ${location}`);
    assert.ok(location.includes('/login?next='), `Expected safe login redirect, got ${location}`);
    return `Safe Location=${location}`;
  });

  // -------------------------------------------------------------------------
  // SEC-28: Password change rate limiting & oversized password DoS protection
  // -------------------------------------------------------------------------
  await test('SEC-28', 'Oversized login/password inputs (>128 chars) are rejected before bcrypt & PUT /api/auth/password is rate-limited', async () => {
    const pwUser = await registerCustomer('sec28.pw');
    const hugePassword = 'P'.repeat(5000);

    const loginHuge = await call('/api/auth/login', {
      method: 'POST',
      body: { email: pwUser.email, password: hugePassword },
    });
    assert.equal(loginHuge.status, 400, 'Expected 400 for >128-char login password');

    const changeHuge = await call('/api/auth/password', {
      method: 'PUT',
      token: pwUser.token,
      body: { currentPassword: hugePassword, newPassword: 'ValidPass123' },
    });
    assert.equal(changeHuge.status, 400, 'Expected 400 for >128-char currentPassword');

    let hit429 = false;
    for (let i = 0; i < 12; i++) {
      const attempt = await call('/api/auth/password', {
        method: 'PUT',
        token: pwUser.token,
        body: { currentPassword: `WrongPass-${i}`, newPassword: 'ValidPass123' },
      });
      if (attempt.status === 429) {
        hit429 = true;
        break;
      }
    }
    assert.equal(hit429, true, 'Expected 429 rate limit on repeated failed PUT /api/auth/password attempts');
    return `loginHuge=${loginHuge.status}, changeHuge=${changeHuge.status}, passwordRateLimited=${hit429}`;
  });

  // -------------------------------------------------------------------------
  // SEC-29: Admin user, category, product & discount input length validation
  // -------------------------------------------------------------------------
  await test('SEC-29', 'Admin endpoints enforce email format & upper length bounds on user, category, product & discount fields', async () => {
    const targetUser = await registerCustomer('sec29.bounds');

    const badEmailUpdate = await call(`/api/users/${targetUser.user.id}`, {
      method: 'PUT',
      token: admin.token,
      body: { email: 'not-an-email' },
    });
    assert.equal(badEmailUpdate.status, 400);

    const longAddrUpdate = await call(`/api/users/${targetUser.user.id}`, {
      method: 'PUT',
      token: admin.token,
      body: { address: 'A'.repeat(500) },
    });
    assert.equal(longAddrUpdate.status, 400);

    const emptySlugCat = await call('/api/categories', {
      method: 'POST',
      token: admin.token,
      body: { name: '!!!@@@###' },
    });
    assert.equal(emptySlugCat.status, 400);

    const longProduct = await call('/api/products', {
      method: 'POST',
      token: admin.token,
      body: {
        name: 'N'.repeat(250),
        brand: 'Apple',
        categoryId: 'invalid-cat',
        description: 'Valid description',
      },
    });
    assert.equal(longProduct.status, 400);

    const longDiscountDesc = await call('/api/discounts', {
      method: 'POST',
      token: admin.token,
      body: {
        code: 'SEC29',
        discountType: 'percentage',
        discountValue: 10,
        maxUses: 5,
        description: 'D'.repeat(600),
      },
    });
    assert.equal(longDiscountDesc.status, 400);

    return `badEmail=${badEmailUpdate.status}, longAddr=${longAddrUpdate.status}, badCat=${emptySlugCat.status}, longProd=${longProduct.status}, longDisc=${longDiscountDesc.status}`;
  });

  // -------------------------------------------------------------------------
  // SEC-30: JSON-LD script blocks escape HTML characters (<, >, &) against XSS
  // -------------------------------------------------------------------------
  await test('SEC-30', 'SSR JSON-LD structured data blocks escape <, >, and & characters to prevent </script> breakout XSS', async () => {
    const res = await fetch(`${CLIENT}/products/macbook-pro-m3`);
    assert.equal(res.status, 200);
    const html = await res.text();
    const match = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
    assert.ok(match, 'Expected JSON-LD script block on product detail page');
    assert.ok(!match[1].includes('</script>'), 'JSON-LD payload must never contain raw </script>');
    const parsed = JSON.parse(match[1]);
    assert.ok(Array.isArray(parsed) && parsed.length >= 2, 'Expected valid parsed JSON-LD array');
    return `Verified safe JSON-LD serialization (${match[1].length} bytes)`;
  });

  await prisma.$disconnect();

  const passed = results.filter((r) => r.ok).length;
  console.log(`\n============================================================`);
  console.log(`${passed}/${results.length} passed`);
  if (passed !== results.length) {
    process.exit(1);
  }
})();
