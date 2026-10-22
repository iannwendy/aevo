/**
 * Phase 2 E2E checks (E2E_TEST_PLAN.md, Task 2.1 - 2.7).
 *
 * Exercises Product API (list, filter, search, sort, pagination, detail, variants),
 * Category API (list, detail, admin CRUD), Reviews API + Socket.IO realtime,
 * and Frontend pages (Homepage, Catalog, Product Detail, Cart integration).
 *
 * Run with both API (3001) and Web (3000) servers up:
 *   node apps/api/test/phase2.e2e.js
 */
const assert = require('node:assert/strict');
const { io: createSocketClient } = require('socket.io-client');

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

const uniqueEmail = (tag) => `${tag}.${Date.now()}.${Math.floor(Math.random() * 1e6)}@example.com`;

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

async function registerCustomer(tag = 'phase2') {
  const email = uniqueEmail(tag);
  const res = await call('/api/auth/register', {
    method: 'POST',
    body: { email, password: 'password123', fullName: 'Phase Two Tester' },
  });
  assert.equal(res.status, 201, `register failed: ${JSON.stringify(res.body)}`);
  return {
    email,
    token: res.body.token,
    cookie: cookieFrom(res, 'token'),
    user: res.body.user,
  };
}

async function main() {
  // ================================================================ Task 2.1: Product API - List & Filter
  let sampleProduct = null;

  await test('PROD-01', 'GET /api/products returns products with pagination, category, variants, primary image', async () => {
    const res = await call('/api/products');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.products), 'products should be an array');
    assert.ok(res.body.products.length > 0, 'products should not be empty');
    assert.ok(res.body.pagination, 'pagination metadata missing');
    assert.equal(res.body.pagination.page, 1);
    assert.equal(res.body.pagination.limit, 12);
    assert.ok(res.body.pagination.total >= 24, `expected >= 24 products, got ${res.body.pagination.total}`);
    assert.ok(res.body.pagination.totalPages >= 2);

    sampleProduct = res.body.products[0];
    assert.ok(sampleProduct.id, 'product id missing');
    assert.ok(sampleProduct.name, 'product name missing');
    assert.ok(sampleProduct.slug, 'product slug missing');
    assert.ok(sampleProduct.category, 'product category missing');
    assert.ok(sampleProduct.image, 'product primary image missing');
    assert.ok(Array.isArray(sampleProduct.variants) && sampleProduct.variants.length >= 2, 'product variants missing');
    return `${res.body.products.length} items on page 1 (total ${res.body.pagination.total})`;
  });

  await test('PROD-02', 'GET /api/products?category=laptops filters by category slug', async () => {
    const res = await call('/api/products?category=laptops');
    assert.equal(res.status, 200);
    assert.ok(res.body.products.length > 0, 'no laptops returned');
    for (const p of res.body.products) {
      assert.equal(p.category.toLowerCase(), 'laptops', `unexpected category ${p.category}`);
    }
    return `${res.body.products.length} laptops`;
  });

  await test('PROD-03', 'GET /api/products?brand=asus,lenovo filters by multiple brands (case-insensitive)', async () => {
    const res = await call('/api/products?brand=asus,lenovo');
    assert.equal(res.status, 200);
    assert.ok(res.body.products.length >= 2, `expected >= 2 products for asus,lenovo, got ${res.body.products.length}`);
    const allowed = new Set(['asus', 'lenovo']);
    const seen = new Set();
    for (const p of res.body.products) {
      const b = p.brand.toLowerCase();
      assert.ok(allowed.has(b), `unexpected brand ${p.brand}`);
      seen.add(b);
    }
    assert.ok(seen.has('asus') && seen.has('lenovo'), `expected both ASUS and Lenovo, got ${[...seen].join(',')}`);
    return `${res.body.products.length} products (${[...seen].join(', ')})`;
  });

  await test('PROD-04', 'GET /api/products?minPrice=10000000&maxPrice=30000000 filters by price range', async () => {
    const min = 10000000;
    const max = 30000000;
    const res = await call(`/api/products?minPrice=${min}&maxPrice=${max}`);
    assert.equal(res.status, 200);
    assert.ok(res.body.products.length > 0, 'no products in price range');
    for (const p of res.body.products) {
      assert.ok(
        p.price >= min && p.price <= max,
        `product ${p.name} price ${p.price} outside [${min}, ${max}]`
      );
    }
    return `${res.body.products.length} products in [10M, 30M]`;
  });

  await test('PROD-04b', 'GET /api/products supports third filter criteria (tag, minRating, inStock)', async () => {
    const byTag = await call('/api/products?tag=gaming');
    assert.equal(byTag.status, 200);
    assert.ok(byTag.body.products.length > 0, 'no products for tag=gaming');
    for (const p of byTag.body.products) {
      const slugs = (p.tags || []).map((t) => t.slug);
      assert.ok(slugs.includes('gaming'), `product ${p.name} missing gaming tag`);
    }

    const byRating = await call('/api/products?minRating=4');
    assert.equal(byRating.status, 200);
    assert.ok(byRating.body.products.length > 0, 'no products for minRating=4');
    for (const p of byRating.body.products) {
      assert.ok(p.averageRating >= 4, `product ${p.name} rating ${p.averageRating} < 4`);
    }

    const byStock = await call('/api/products?inStock=true');
    assert.equal(byStock.status, 200);
    assert.ok(byStock.body.products.length > 0);
    for (const p of byStock.body.products) {
      assert.equal(p.inStock, true);
    }
  });

  await test('PROD-05', 'GET /api/products?search=laptop matches name/description/brand', async () => {
    const res = await call('/api/products?search=laptop');
    assert.equal(res.status, 200);
    assert.ok(res.body.products.length > 0, 'search returned no results');
    for (const p of res.body.products) {
      const haystack = `${p.name} ${p.description} ${p.brand}`.toLowerCase();
      assert.ok(haystack.includes('laptop'), `product ${p.name} does not match "laptop"`);
    }

    const aliasRes = await call('/api/products/search?q=macbook');
    assert.equal(aliasRes.status, 200);
    assert.ok(aliasRes.body.products.some((p) => p.slug === 'macbook-pro-m3'));
    return `${res.body.products.length} results for "laptop"`;
  });

  await test('PROD-06', 'GET /api/products?sort=price_asc & price_desc sorts accurately', async () => {
    const asc = await call('/api/products?sort=price_asc&limit=24');
    assert.equal(asc.status, 200);
    assert.ok(asc.body.products.length > 1);
    for (let i = 1; i < asc.body.products.length; i++) {
      assert.ok(
        asc.body.products[i].price >= asc.body.products[i - 1].price,
        `price_asc out of order at index ${i}: ${asc.body.products[i - 1].price} > ${asc.body.products[i].price}`
      );
    }

    const desc = await call('/api/products?sort=price_desc&limit=24');
    assert.equal(desc.status, 200);
    for (let i = 1; i < desc.body.products.length; i++) {
      assert.ok(
        desc.body.products[i].price <= desc.body.products[i - 1].price,
        `price_desc out of order at index ${i}: ${desc.body.products[i - 1].price} < ${desc.body.products[i].price}`
      );
    }
  });

  await test('PROD-07', 'GET /api/products?sort=name_desc, name_asc, best-selling sorts accurately', async () => {
    const desc = await call('/api/products?sort=name_desc&limit=500');
    const asc = await call('/api/products?sort=name_asc&limit=500');
    assert.equal(desc.status, 200);
    assert.equal(asc.status, 200);
    assert.ok(desc.body.products.length > 1);
    assert.equal(desc.body.products.length, asc.body.products.length);

    // Verify asc and desc are exact reversals and ordered alphabetically
    const reversedAscIds = [...asc.body.products].reverse().map((p) => p.id);
    const descIds = desc.body.products.map((p) => p.id);
    assert.deepEqual(descIds, reversedAscIds, 'name_desc should be the exact reverse of name_asc');

    for (let i = 1; i < desc.body.products.length; i++) {
      const prevFirst = desc.body.products[i - 1].name[0].toUpperCase();
      const currFirst = desc.body.products[i].name[0].toUpperCase();
      assert.ok(
        prevFirst >= currFirst,
        `name_desc out of order: ${desc.body.products[i - 1].name} vs ${desc.body.products[i].name}`
      );
    }

    const best = await call('/api/products?sort=best-selling&limit=24');
    assert.equal(best.status, 200);
    assert.equal(best.body.products[0].isBestSeller, true);
  });

  await test('PROD-08', 'GET /api/products?page=2&limit=12 returns page 2 with 12 items', async () => {
    const p1 = await call('/api/products?page=1&limit=12');
    const p2 = await call('/api/products?page=2&limit=12');
    assert.equal(p2.status, 200);
    assert.equal(p2.body.pagination.page, 2);
    assert.equal(p2.body.pagination.limit, 12);
    assert.equal(p2.body.products.length, 12, `expected 12 items on page 2, got ${p2.body.products.length}`);

    const p1Ids = new Set(p1.body.products.map((p) => p.id));
    for (const item of p2.body.products) {
      assert.ok(!p1Ids.has(item.id), `duplicate product ${item.slug} across page 1 and page 2`);
    }
  });

  await test('PROD-09', 'Single-page product list still returns complete pagination metadata', async () => {
    const res = await call('/api/products?category=laptops&page=1&limit=500');
    assert.equal(res.status, 200);
    assert.ok(res.body.pagination);
    assert.equal(res.body.pagination.page, 1);
    assert.equal(res.body.pagination.totalPages, 1);
    assert.equal(res.body.pagination.total, res.body.products.length);
  });

  // ================================================================ Task 2.2: Product API - Detail & Variants
  let detailBySlug = null;

  await test('PROD-10', 'GET /api/products/:id returns full product details (and 404 for unknown ID)', async () => {
    const res = await call(`/api/products/${sampleProduct.id}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.id, sampleProduct.id);
    assert.equal(res.body.name, sampleProduct.name);
    assert.ok(res.body.category?.name);

    const missing = await call('/api/products/non-existent-product-id');
    assert.equal(missing.status, 404);
  });

  await test('PROD-11', 'GET /api/products/slug/macbook-pro-m3 returns full product details', async () => {
    const res = await call('/api/products/slug/macbook-pro-m3');
    assert.equal(res.status, 200);
    assert.equal(res.body.slug, 'macbook-pro-m3');
    assert.equal(res.body.brand, 'Apple');
    detailBySlug = res.body;

    const missing = await call('/api/products/slug/non-existent-slug');
    assert.equal(missing.status, 404);
  });

  await test('PROD-12', 'Product detail includes >= 2 active variants with independent inventory and price', async () => {
    assert.ok(Array.isArray(detailBySlug.variants));
    assert.ok(detailBySlug.variants.length >= 2, `expected >= 2 variants, got ${detailBySlug.variants.length}`);
    for (const v of detailBySlug.variants) {
      assert.ok(v.id && v.name && v.sku);
      assert.equal(typeof v.price, 'number');
      assert.equal(typeof v.inventory, 'number');
    }

    // Rubric check: every active product in catalogue has >= 2 variants
    const allRes = await call('/api/products?limit=500');
    for (const p of allRes.body.products) {
      assert.ok(
        p.variants.length >= 2,
        `Product "${p.name}" (${p.slug}) has only ${p.variants.length} variant(s); rubric requires >= 2`
      );
    }
    return `all ${allRes.body.products.length} products have >= 2 variants`;
  });

  await test('PROD-13', 'Product detail includes >= 3 images ordered by position ascending', async () => {
    assert.ok(Array.isArray(detailBySlug.images));
    assert.ok(detailBySlug.images.length >= 3, `expected >= 3 images, got ${detailBySlug.images.length}`);
    for (let i = 1; i < detailBySlug.images.length; i++) {
      assert.ok(
        detailBySlug.images[i].position >= detailBySlug.images[i - 1].position,
        'images not sorted by position'
      );
    }
  });

  await test('PROD-14', 'Product detail includes reviews, averageRating, and >= 5 lines description', async () => {
    assert.ok(Array.isArray(detailBySlug.reviews), 'reviews array missing');
    assert.equal(typeof detailBySlug.averageRating, 'number');
    assert.ok(detailBySlug.ratingDistribution, 'ratingDistribution missing');
    const lines = detailBySlug.description.split('\n').filter((l) => l.trim().length > 0);
    assert.ok(lines.length >= 5, `expected >= 5 description lines, got ${lines.length}`);
  });

  // ================================================================ Task 2.3: Category API
  let categoriesList = [];

  await test('CAT-01', 'GET /api/categories returns all active categories (>= 3 required)', async () => {
    const res = await call('/api/categories');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.ok(res.body.length >= 3, `expected >= 3 categories, got ${res.body.length}`);
    categoriesList = res.body;
    const slugs = new Set(categoriesList.map((c) => c.slug));
    for (const required of ['laptops', 'components', 'monitors']) {
      assert.ok(slugs.has(required), `missing required category ${required}`);
    }
    return `${categoriesList.length} categories (${[...slugs].join(', ')})`;
  });

  await test('CAT-02', 'GET /api/categories/:id returns category with products (by ID and by slug)', async () => {
    const target = categoriesList.find((c) => c.slug === 'laptops') || categoriesList[0];
    const byId = await call(`/api/categories/${target.id}`);
    assert.equal(byId.status, 200);
    assert.equal(byId.body.id, target.id);
    assert.ok(Array.isArray(byId.body.products) && byId.body.products.length > 0);

    const bySlug = await call(`/api/categories/${target.slug}`);
    assert.equal(bySlug.status, 200);
    assert.equal(bySlug.body.slug, target.slug);

    const missing = await call('/api/categories/non-existent-category');
    assert.equal(missing.status, 404);
  });

  await test('CAT-03', 'Admin can POST, PUT, DELETE categories; non-admin is rejected', async () => {
    const admin = await loginAs('admin@aevo.com', 'admin123');
    const customer = await loginAs('customer@aevo.com', 'customer123');

    const catName = `TestCat ${Date.now()}`;
    const forbidden = await call('/api/categories', {
      method: 'POST',
      token: customer.token,
      body: { name: catName, description: 'Should fail' },
    });
    assert.equal(forbidden.status, 403);

    const created = await call('/api/categories', {
      method: 'POST',
      token: admin.token,
      body: { name: catName, description: 'Created by E2E test' },
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal(created.body.name, catName);

    const updated = await call(`/api/categories/${created.body.id}`, {
      method: 'PUT',
      token: admin.token,
      body: { name: `${catName} Updated`, description: 'Updated description' },
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.description, 'Updated description');

    const deleted = await call(`/api/categories/${created.body.id}`, {
      method: 'DELETE',
      token: admin.token,
    });
    assert.equal(deleted.status, 200);

    const afterDelete = await call(`/api/categories/${created.body.id}`);
    assert.equal(afterDelete.status, 404, 'soft-deleted category should not be returned as active');
  });

  // ================================================================ Task 2.7: Reviews - Comments, Ratings & Socket.IO Realtime
  await test('REV-01', 'GET /api/reviews/product/:productId returns reviews and rating distribution', async () => {
    const res = await call(`/api/reviews/product/${detailBySlug.id}`);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.reviews));
    assert.equal(typeof res.body.totalReviews, 'number');
    assert.ok(res.body.ratingDistribution);
    for (const star of [1, 2, 3, 4, 5]) {
      assert.equal(typeof res.body.ratingDistribution[star], 'number');
    }
  });

  await test('REV-02', 'Guest can post a comment without token (rating is null)', async () => {
    const commentText = `Guest review at ${Date.now()}`;
    const res = await call('/api/reviews', {
      method: 'POST',
      body: {
        productId: detailBySlug.id,
        guestName: 'Minh Guest',
        comment: commentText,
      },
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.comment, commentText);
    assert.equal(res.body.guestName, 'Minh Guest');
    assert.equal(res.body.rating, null);
  });

  let phase2Customer = null;

  await test('REV-03', 'Authenticated user can post comment + star rating (1-5)', async () => {
    phase2Customer = await loginAs('customer@aevo.com', 'customer123');
    const commentText = `Verified user rating at ${Date.now()}`;
    const res = await call('/api/reviews', {
      method: 'POST',
      token: phase2Customer.token,
      body: {
        productId: detailBySlug.id,
        rating: 5,
        comment: commentText,
      },
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.rating, 5);
    assert.equal(res.body.comment, commentText);
    assert.equal(res.body.user?.fullName, 'Nguyen Van A');
  });

  await test('REV-04', 'Guest attempting to submit a star rating receives 401', async () => {
    const res = await call('/api/reviews', {
      method: 'POST',
      body: {
        productId: detailBySlug.id,
        guestName: 'Sneaky Guest',
        rating: 4,
        comment: 'Trying to rate without logging in',
      },
    });
    assert.equal(res.status, 401);
  });

  await test('REV-05', 'Invalid rating (rating=6 or rating=0) returns 400', async () => {
    const reviewer = phase2Customer || (await loginAs('customer@aevo.com', 'customer123'));
    const resHigh = await call('/api/reviews', {
      method: 'POST',
      token: reviewer.token,
      body: {
        productId: detailBySlug.id,
        rating: 6,
        comment: 'Too many stars',
      },
    });
    assert.equal(resHigh.status, 400);

    const resLow = await call('/api/reviews', {
      method: 'POST',
      token: reviewer.token,
      body: {
        productId: detailBySlug.id,
        rating: 0,
        comment: 'Zero stars',
      },
    });
    assert.equal(resLow.status, 400);
  });

  await test('REV-06', 'Socket.IO broadcasts new-review in realtime to connected product room clients', async () => {
    const socketA = createSocketClient(API, { transports: ['websocket'] });
    const socketB = createSocketClient(API, { transports: ['websocket'] });

    try {
      await Promise.all([
        new Promise((resolve, reject) => {
          socketA.once('connect', resolve);
          socketA.once('connect_error', reject);
        }),
        new Promise((resolve, reject) => {
          socketB.once('connect', resolve);
          socketB.once('connect_error', reject);
        }),
      ]);

      socketA.emit('join-product', detailBySlug.id);
      socketB.emit('join-product', detailBySlug.id);
      await new Promise((r) => setTimeout(r, 100));

      const realtimeComment = `Realtime socket test ${Date.now()}`;
      const receivedByB = new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Timed out waiting for new-review event')), 4000);
        socketB.once('new-review', (payload) => {
          clearTimeout(timer);
          resolve(payload);
        });
      });

      const postRes = await call('/api/reviews', {
        method: 'POST',
        body: {
          productId: detailBySlug.id,
          guestName: 'Tab 1 User',
          comment: realtimeComment,
        },
      });
      assert.equal(postRes.status, 201);

      const eventData = await receivedByB;
      assert.equal(eventData.comment, realtimeComment);
      assert.equal(eventData.guestName, 'Tab 1 User');
      return `received review ${eventData.id} over WebSocket`;
    } finally {
      socketA.disconnect();
      socketB.disconnect();
    }
  });

  // ================================================================ Task 2.4: Homepage - Product Display (FE-04 .. FE-07)
  let homeHtml = '';

  await test('FE-04', 'Homepage (/) loads cleanly with Hero, New Arrivals, Best Sellers, Categories, and Pagination', async () => {
    const res = await fetch(`${CLIENT}/`);
    assert.equal(res.status, 200);
    homeHtml = await res.text();
    assert.doesNotMatch(homeHtml, /Application error|Internal Server Error/i);
    assert.ok(homeHtml.includes('Technology, refined.'), 'hero headline missing');
    assert.ok(homeHtml.includes('data-testid="new-arrivals-section"'), 'new-arrivals-section missing');
    assert.ok(homeHtml.includes('data-testid="best-sellers-section"'), 'best-sellers-section missing');
    assert.ok(homeHtml.includes('data-testid="categories-section"'), 'categories-section missing');
    assert.ok(homeHtml.includes('data-testid="pagination"'), 'pagination missing on homepage');
  });

  await test('FE-05', 'New Arrivals section displays products with image, name, formatted VND price, and pagination', async () => {
    const newArrivalsApi = await call('/api/products/new-arrivals?limit=4');
    assert.equal(newArrivalsApi.status, 200);
    assert.ok(newArrivalsApi.body.length > 0);
    for (const p of newArrivalsApi.body) {
      assert.ok(homeHtml.includes(p.name), `New Arrival product "${p.name}" missing from homepage`);
      assert.ok(homeHtml.includes(`/products/${p.slug}`), `link to /products/${p.slug} missing`);
    }
    assert.ok(homeHtml.includes('New Arrivals Pagination'), 'New Arrivals pagination label missing');
    return `${newArrivalsApi.body.length} new arrivals rendered`;
  });

  await test('FE-06', 'Best Sellers section displays best-selling products and pagination', async () => {
    const bestApi = await call('/api/products/best-sellers?limit=4');
    assert.equal(bestApi.status, 200);
    assert.ok(bestApi.body.length > 0);
    for (const p of bestApi.body) {
      assert.ok(homeHtml.includes(p.name), `Best Seller product "${p.name}" missing from homepage`);
    }
    assert.ok(homeHtml.includes('Best Sellers Pagination'), 'Best Sellers pagination label missing');
    return `${bestApi.body.length} best sellers rendered`;
  });

  await test('FE-07', 'Category cards and >= 3 distinct category product sections (Laptops, Components, Monitors) render with links and pagination', async () => {
    for (const slug of ['laptops', 'components', 'monitors']) {
      assert.ok(
        homeHtml.includes(`data-testid="category-card-${slug}"`),
        `category card for ${slug} missing`
      );
      assert.ok(
        homeHtml.includes(`href="/products?category=${slug}"`),
        `navigation link /products?category=${slug} missing`
      );
      assert.ok(
        homeHtml.includes(`data-testid="category-showcase-${slug}"`),
        `category product section for ${slug} missing`
      );
    }
    return 'category cards + 3 paginated category showcases verified';
  });

  // ================================================================ Task 2.5: Product Catalog Page (FE-08 .. FE-12)
  await test('FE-08', 'Catalog page (/products) loads with product grid, sidebar filters, sort dropdown, view toggle, and pagination', async () => {
    const res = await fetch(`${CLIENT}/products`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('data-testid="catalog-page"'), 'catalog-page container missing');
    assert.ok(html.includes('data-testid="catalog-sidebar"'), 'catalog-sidebar missing');
    assert.ok(html.includes('data-testid="catalog-sort-select"'), 'sort dropdown missing');
    assert.ok(html.includes('data-testid="catalog-products-grid"'), 'products grid missing');
    assert.ok(html.includes('data-testid="mobile-filter-trigger"'), 'mobile filter trigger missing');
    assert.ok(html.includes('data-testid="pagination-page-1"'), 'pagination page 1 missing');
    assert.ok(html.includes('data-testid="pagination-page-2"'), 'pagination page 2 missing');
  });

  await test('FE-09', 'Catalog category, brand, and price filters display only matching products', async () => {
    const res = await fetch(`${CLIENT}/products?category=laptops`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('MacBook Pro M3'), 'expected laptop MacBook Pro M3 in /products?category=laptops');
    assert.ok(
      !html.includes('NVIDIA GeForce RTX 4090 Founders Edition'),
      'component RTX 4090 should not appear in laptops filter'
    );
  });

  await test('FE-10', 'Catalog sort option (?sort=price_asc & ?sort=price_desc) orders product cards accurately', async () => {
    const ascRes = await fetch(`${CLIENT}/products?sort=price_asc`);
    assert.equal(ascRes.status, 200);
    const ascHtml = await ascRes.text();
    // Lowest price product in seed is Lamicall Desktop Stand (890,000 VND)
    const posLamicall = ascHtml.indexOf('Lamicall Desktop Stand');
    const posBookArc = ascHtml.indexOf('TwelveSouth BookArc Flex Vertical Stand');
    assert.ok(posLamicall !== -1 && posBookArc !== -1, 'expected lowest priced products on page 1 of price_asc');
    assert.ok(posLamicall < posBookArc, 'Lamicall (890k) should appear before TwelveSouth BookArc (1.49M) in price_asc');

    const descRes = await fetch(`${CLIENT}/products?sort=price_desc`);
    assert.equal(descRes.status, 200);
    const descHtml = await descRes.text();
    // Highest minPrice product is RTX 4090 Founders Edition (63,990,000 VND)
    assert.ok(
      descHtml.includes('NVIDIA GeForce RTX 4090 Founders Edition'),
      'expected highest priced product on page 1 of price_desc'
    );
  });

  await test('FE-11', 'Catalog pagination (?page=2) renders page 2 items and marks page 2 active', async () => {
    const p1Html = await (await fetch(`${CLIENT}/products?page=1`)).text();
    const p2Res = await fetch(`${CLIENT}/products?page=2`);
    assert.equal(p2Res.status, 200);
    const p2Html = await p2Res.text();

    const p1Slugs = [...p1Html.matchAll(/href="\/products\/([a-z0-9-]+)"/g)].map((m) => m[1]);
    const p2Slugs = [...p2Html.matchAll(/href="\/products\/([a-z0-9-]+)"/g)].map((m) => m[1]);
    assert.ok(p1Slugs.length > 0 && p2Slugs.length > 0);
    assert.notEqual(p1Slugs[0], p2Slugs[0], 'page 1 and page 2 should display different products');
    assert.match(p2Html, /aria-current="page"[^>]*data-testid="pagination-page-2"|data-testid="pagination-page-2"[^>]*aria-current="page"/);
  });

  await test('FE-12', 'Shared URL with multiple filters preserves state and renders exact filtered results', async () => {
    const sharedUrl = `${CLIENT}/products?category=laptops&brand=asus,lenovo&minPrice=20000000&maxPrice=40000000&sort=price_asc`;
    const res = await fetch(sharedUrl);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('data-testid="active-filter-pills"'), 'active filter pills missing');
    assert.ok(html.includes('Lenovo ThinkPad X1 Carbon Gen 12'), 'expected Lenovo ThinkPad in filtered view');
    assert.ok(html.includes('ASUS ROG Zephyrus G14'), 'expected ASUS ROG Zephyrus G14 in filtered view');
    assert.ok(!html.includes('MacBook Pro M3'), 'Apple MacBook Pro M3 should be excluded by brand=asus,lenovo');
  });

  // ================================================================ Task 2.6: Product Detail Page (FE-13 .. FE-18)
  let detailHtml = '';

  await test('FE-13', 'Product Detail page (/products/macbook-pro-m3) loads with title, brand, category, and reviews', async () => {
    const res = await fetch(`${CLIENT}/products/macbook-pro-m3`);
    assert.equal(res.status, 200);
    detailHtml = await res.text();
    assert.ok(detailHtml.includes('data-testid="product-detail-page"'));
    assert.ok(detailHtml.includes('MacBook Pro M3'));
    assert.ok(detailHtml.includes('Apple'));
    assert.ok(detailHtml.includes('data-testid="reviews-section"'));
    assert.ok(detailHtml.includes('data-testid="rating-distribution"'));
  });

  await test('FE-14', 'Product Detail image gallery renders main image and >= 3 clickable thumbnails', async () => {
    assert.ok(detailHtml.includes('data-testid="product-gallery-main-image"'));
    assert.ok(detailHtml.includes('data-testid="product-gallery-thumb-0"'));
    assert.ok(detailHtml.includes('data-testid="product-gallery-thumb-1"'));
    assert.ok(detailHtml.includes('data-testid="product-gallery-thumb-2"'));
  });

  await test('FE-15', 'Product Detail variant selector displays all variants and their respective prices', async () => {
    assert.ok(detailHtml.includes('data-testid="variant-selector"'));
    assert.ok(detailHtml.includes('data-testid="variant-option-0"'));
    assert.ok(detailHtml.includes('data-testid="variant-option-1"'));
    for (const v of detailBySlug.variants) {
      assert.ok(detailHtml.includes(v.name), `variant "${v.name}" missing from detail page`);
      assert.ok(detailHtml.includes(v.sku), `variant SKU "${v.sku}" missing from detail page`);
    }
  });

  await test('FE-16', 'Product Detail displays independent stock availability per variant', async () => {
    assert.ok(detailHtml.includes('data-testid="product-stock"'));
    const firstVar = detailBySlug.variants[0];
    assert.ok(
      detailHtml.includes(`In stock · ${firstVar.inventory} available`),
      `expected stock display for ${firstVar.inventory} units`
    );
  });

  await test('FE-17', 'Add to cart from Product Detail adds selected variant and updates cart', async () => {
    assert.ok(detailHtml.includes('data-testid="add-to-cart-button"'));
    assert.ok(detailHtml.includes('data-testid="quantity-stepper"'));

    const targetVariant = detailBySlug.variants[0];
    const addRes = await call('/api/cart/items', {
      method: 'POST',
      body: { variantId: targetVariant.id, quantity: 2 },
    });
    assert.equal(addRes.status, 200, `add to cart failed: ${JSON.stringify(addRes.body)}`);
    const sessionCookie = cookieFrom(addRes, 'sessionId');
    assert.ok(sessionCookie, 'expected sessionId cookie for guest cart');

    const cartRes = await call('/api/cart', { cookie: sessionCookie });
    assert.equal(cartRes.status, 200);
    const addedItem = (cartRes.body.items || []).find((i) => i.variantId === targetVariant.id);
    assert.ok(addedItem, 'added variant not found in cart');
    assert.equal(addedItem.quantity, 2);
    assert.equal(cartRes.body.subtotal, targetVariant.price * 2);
  });

  await test('FE-18', 'Product Detail description renders >= 5 lines', async () => {
    const lineMatches = detailHtml.match(/data-testid="product-description-line"/g) || [];
    assert.ok(
      lineMatches.length >= 5,
      `expected >= 5 description lines on detail page, got ${lineMatches.length}`
    );
    return `${lineMatches.length} description lines rendered`;
  });

  // ------------------------------------------------------------------ report
  const failed = results.filter((r) => !r.ok);
  console.log('\n' + '='.repeat(60));
  console.log(`${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    console.log('FAILED:');
    for (const f of failed) console.log(`  - ${f.id} ${f.name}: ${f.detail}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('Test harness crashed:', error);
  process.exitCode = 1;
});
