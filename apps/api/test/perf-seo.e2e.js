/**
 * Performance & SEO End-to-End Verification Suite (PERF-01 .. PERF-04, SEO-01 .. SEO-06)
 * Verifies all optimizations documented in docs/PERFORMANCE_AND_SEO_OPTIMIZATION.md
 * while ensuring 100% compliance with docs/requirement.md and existing application flows.
 *
 * Run with both API (3001) and Web (3000) servers up:
 *   node apps/api/test/perf-seo.e2e.js
 */
const assert = require('node:assert/strict');

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

async function launchBrowser() {
  try {
    return await chromium.launch({ headless: true, channel: 'chrome' });
  } catch {
    return await chromium.launch({ headless: true });
  }
}

function extractJsonLdBlocks(html) {
  const regex = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  const blocks = [];
  let match;
  while ((match = regex.exec(html)) !== null) {
    const parsed = JSON.parse(match[1]);
    if (Array.isArray(parsed)) {
      blocks.push(...parsed);
    } else {
      blocks.push(parsed);
    }
  }
  return blocks;
}

async function main() {
  console.log('\n=== Performance & SEO Full E2E Verification Suite ===\n');

  // =========================================================================
  // Technical SEO & Structured Data (SEO-01 .. SEO-06)
  // =========================================================================
  console.log('--- Group 1: Technical SEO & Structured Data (SEO-01 .. SEO-06) ---');

  await test('SEO-01', 'GET /robots.txt exposes crawler rules and Sitemap declaration', async () => {
    const res = await fetch(`${CLIENT}/robots.txt`);
    assert.equal(res.status, 200);
    const text = await res.text();
    assert.match(text, /User-Agent:\s*\*/i);
    assert.match(text, /Allow:\s*\/products/i);
    assert.match(text, /Disallow:\s*\/admin\//i);
    assert.match(text, /Disallow:\s*\/checkout\//i);
    assert.match(text, /Disallow:\s*\/cart/i);
    assert.match(text, /Sitemap:\s*http:\/\/localhost:3000\/sitemap\.xml/i);
    return 'robots.txt allow/disallow rules & sitemap verified';
  });

  await test('SEO-02', 'GET /sitemap.xml dynamically lists store, categories, and all active products', async () => {
    const res = await fetch(`${CLIENT}/sitemap.xml`);
    assert.equal(res.status, 200);
    const xml = await res.text();
    assert.ok(xml.includes('<urlset'), 'Expected valid <urlset> root element');
    assert.ok(xml.includes('<loc>http://localhost:3000/</loc>'), 'Expected homepage in sitemap');
    assert.ok(xml.includes('<loc>http://localhost:3000/products</loc>'), 'Expected /products in sitemap');
    assert.ok(
      xml.includes('<loc>http://localhost:3000/products?category=laptops</loc>'),
      'Expected category URLs in sitemap'
    );
    assert.ok(
      xml.includes('<loc>http://localhost:3000/products/macbook-pro-m3</loc>'),
      'Expected product slug URLs in sitemap'
    );
    const urlCount = (xml.match(/<url>/g) || []).length;
    assert.ok(urlCount >= 100, `Expected >= 100 indexed URLs in sitemap, got ${urlCount}`);
    return `${urlCount} dynamic URLs indexed in sitemap.xml`;
  });

  await test('SEO-03', 'Homepage (/) renders WebSite + ComputerStore JSON-LD, Canonical, and OpenGraph metadata', async () => {
    const res = await fetch(`${CLIENT}/`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /<title>AEVO - Home<\/title>/);
    assert.match(html, /rel="canonical"[^>]*href="http:\/\/localhost:3000\/?"/);
    assert.match(html, /property="og:title"[^>]*content="AEVO - Home"/);
    assert.match(html, /name="twitter:card"[^>]*content="summary_large_image"/);

    const schemas = extractJsonLdBlocks(html);
    const websiteSchema = schemas.find((s) => s['@type'] === 'WebSite');
    const storeSchema = schemas.find((s) => s['@type'] === 'ComputerStore');
    assert.ok(websiteSchema, 'Missing WebSite JSON-LD schema on homepage');
    assert.equal(websiteSchema.potentialAction?.['@type'], 'SearchAction');
    assert.ok(storeSchema, 'Missing ComputerStore JSON-LD schema on homepage');
    assert.equal(storeSchema.currenciesAccepted, 'VND');
    return 'WebSite (SearchAction) + ComputerStore JSON-LD & OpenGraph verified';
  });

  await test('SEO-04', 'Catalog (/products & ?category=laptops) renders CollectionPage + BreadcrumbList JSON-LD and canonical URL', async () => {
    const res = await fetch(`${CLIENT}/products?category=laptops`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /<title>AEVO - Laptops<\/title>/);
    assert.ok(
      html.includes('href="http://localhost:3000/products?category=laptops"'),
      'Expected category canonical link on /products?category=laptops'
    );
    const schemas = extractJsonLdBlocks(html);
    assert.ok(schemas.some((s) => s['@type'] === 'CollectionPage'), 'Missing CollectionPage schema');
    assert.ok(schemas.some((s) => s['@type'] === 'BreadcrumbList'), 'Missing BreadcrumbList schema');
    return 'CollectionPage + BreadcrumbList JSON-LD & canonical verified';
  });

  await test('SEO-05', 'Product Detail (/products/macbook-pro-m3) renders Product + Offer + AggregateRating + BreadcrumbList JSON-LD and Tag keywords', async () => {
    const res = await fetch(`${CLIENT}/products/macbook-pro-m3`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /<title>AEVO - MacBook Pro M3<\/title>/);
    assert.ok(
      html.includes('href="http://localhost:3000/products/macbook-pro-m3"'),
      'Missing canonical URL on Product Detail page'
    );
    assert.match(html, /property="og:image"/, 'Missing og:image on Product Detail page');
    assert.match(html, /name="keywords"[^>]*content="[^"]*Apple[^"]*"/i, 'Missing brand/tag keywords meta');

    const schemas = extractJsonLdBlocks(html);
    const prodSchema = schemas.find((s) => s['@type'] === 'Product');
    const breadSchema = schemas.find((s) => s['@type'] === 'BreadcrumbList');
    assert.ok(prodSchema, 'Missing Product JSON-LD schema');
    assert.equal(prodSchema.name, 'MacBook Pro M3');
    assert.equal(prodSchema.brand?.name, 'Apple');
    assert.equal(prodSchema.offers?.priceCurrency, 'VND');
    assert.ok(prodSchema.offers?.lowPrice > 0, 'Expected positive VND offer price in JSON-LD');
    assert.match(prodSchema.offers?.availability || '', /schema\.org\/(InStock|OutOfStock)/);
    assert.ok(breadSchema, 'Missing BreadcrumbList JSON-LD schema on PDP');
    assert.equal(breadSchema.itemListElement?.length, 4);
    return `Product JSON-LD (lowPrice=${prodSchema.offers.lowPrice} VND, offers=${prodSchema.offers.offerCount}) verified`;
  });

  await test('SEO-06', 'Private/transactional routes (/cart, /checkout, /login, /register, /account/profile) enforce noindex, nofollow', async () => {
    const privateRoutes = ['/cart', '/checkout', '/login', '/register', '/account/profile'];
    for (const route of privateRoutes) {
      const res = await fetch(`${CLIENT}${route}`);
      assert.equal(res.status, 200, `Expected 200 on ${route}`);
      const html = await res.text();
      assert.match(
        html,
        /name="robots"[^>]*content="noindex,\s*nofollow"/i,
        `Expected noindex, nofollow on ${route}`
      );
    }
    return `Verified noindex, nofollow on ${privateRoutes.join(', ')}`;
  });

  // =========================================================================
  // Backend & Frontend Performance Optimizations (PERF-01 .. PERF-04)
  // =========================================================================
  console.log('\n--- Group 2: Backend & Frontend Performance Optimizations (PERF-01 .. PERF-04) ---');

  await test('PERF-01', 'Redis read-through cache serves HIT on /api/categories and /api/products/filters', async () => {
    // First call primes cache if expired; second call must be a cache HIT
    await fetch(`${API}/api/categories`);
    const catHit = await fetch(`${API}/api/categories`);
    assert.equal(catHit.status, 200);
    assert.equal(catHit.headers.get('x-cache'), 'HIT', 'Expected X-Cache: HIT on /api/categories');

    await fetch(`${API}/api/products/filters`);
    const filterHit = await fetch(`${API}/api/products/filters`);
    assert.equal(filterHit.status, 200);
    assert.equal(filterHit.headers.get('x-cache'), 'HIT', 'Expected X-Cache: HIT on /api/products/filters');
    return 'X-Cache: HIT verified on /api/categories & /api/products/filters';
  });

  await test('PERF-02', 'GET /api/products/filters SQL distinct & aggregate responds fast with complete metadata', async () => {
    const start = performance.now();
    const res = await fetch(`${API}/api/products/filters`);
    const elapsedMs = performance.now() - start;
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.brands) && data.brands.length >= 5, 'Expected brands list');
    assert.ok(Array.isArray(data.tags) && data.tags.length > 0, 'Expected tags list');
    assert.ok(data.priceRange?.min > 0 && data.priceRange?.max >= data.priceRange?.min, 'Expected valid priceRange');
    assert.ok(elapsedMs < 200, `Expected response < 200ms, took ${elapsedMs.toFixed(1)}ms`);
    return `${data.brands.length} brands, ${data.tags.length} tags in ${elapsedMs.toFixed(1)}ms`;
  });

  const browser = await launchBrowser();
  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      locale: 'en-US',
    });
    const page = await context.newPage();

    await test('PERF-03', 'SSR+CSR Hydration Deduplication eliminates redundant client API fetches on initial mount while preserving dynamic filtering', async () => {
      const clientApiCalls = [];
      page.on('request', (req) => {
        const url = req.url();
        if (url.includes(':3001/api/products') || url.includes(':3001/api/categories')) {
          clientApiCalls.push(url);
        }
      });

      // 1. Visit Homepage (/) -> SSR already hydrated newArrivals, bestSellers, categories, and category showcases
      await page.goto(`${CLIENT}/`, { waitUntil: 'networkidle' });
      assert.equal(
        clientApiCalls.length,
        0,
        `Expected 0 duplicate client product/category API fetches on / initial mount, got: ${clientApiCalls.join(', ')}`
      );

      // 2. Visit Catalog (/products) -> SSR already hydrated products, categories, and filters
      clientApiCalls.length = 0;
      await page.goto(`${CLIENT}/products`, { waitUntil: 'networkidle' });
      assert.equal(
        clientApiCalls.length,
        0,
        `Expected 0 duplicate client product/category API fetches on /products initial mount, got: ${clientApiCalls.join(', ')}`
      );

      // Verify dynamic client filter interaction STILL triggers API fetch normally
      await page.selectOption('[data-testid="catalog-sort-select"]', 'price_asc');
      await page.waitForTimeout(400);
      assert.ok(
        clientApiCalls.some((u) => u.includes('sort=price_asc')),
        'Expected dynamic sort change to trigger client API fetch with sort=price_asc'
      );

      // 3. Visit Product Detail (/products/macbook-pro-m3) -> SSR already hydrated initialProduct
      clientApiCalls.length = 0;
      await page.goto(`${CLIENT}/products/macbook-pro-m3`, { waitUntil: 'networkidle' });
      assert.equal(
        clientApiCalls.length,
        0,
        `Expected 0 duplicate client product API fetches on /products/macbook-pro-m3 initial mount, got: ${clientApiCalls.join(', ')}`
      );

      return '0 redundant initial client fetches on /, /products, /products/[slug] + dynamic sort fetch verified';
    });

    await test('PERF-04', 'LCP/CLS image attributes (fetchpriority, width, height, decoding) and DNS Prefetch/Preconnect headers are active', async () => {
      const homeRes = await page.goto(`${CLIENT}/`, { waitUntil: 'networkidle' });
      assert.equal(homeRes.headers()['x-dns-prefetch-control'], 'on');

      const heroImgAttrs = await page.evaluate(() => {
        const heroImg = document.querySelector('[data-testid="hero-section"] img');
        const cardImg = document.querySelector('[data-testid="product-card"] img');
        const preconnect = document.querySelector('head link[rel="preconnect"]');
        return {
          heroFetchPriority: heroImg?.getAttribute('fetchpriority'),
          heroLoading: heroImg?.getAttribute('loading'),
          heroDecoding: heroImg?.getAttribute('decoding'),
          heroWidth: heroImg?.getAttribute('width'),
          heroHeight: heroImg?.getAttribute('height'),
          cardLoading: cardImg?.getAttribute('loading'),
          cardDecoding: cardImg?.getAttribute('decoding'),
          cardWidth: cardImg?.getAttribute('width'),
          cardHeight: cardImg?.getAttribute('height'),
          hasPreconnect: Boolean(preconnect),
        };
      });

      assert.equal(heroImgAttrs.heroFetchPriority, 'high');
      assert.equal(heroImgAttrs.heroLoading, 'eager');
      assert.equal(heroImgAttrs.heroDecoding, 'async');
      assert.ok(Number(heroImgAttrs.heroWidth) > 0 && Number(heroImgAttrs.heroHeight) > 0);
      assert.equal(heroImgAttrs.cardLoading, 'lazy');
      assert.equal(heroImgAttrs.cardDecoding, 'async');
      assert.ok(Number(heroImgAttrs.cardWidth) > 0 && Number(heroImgAttrs.cardHeight) > 0);
      assert.equal(heroImgAttrs.hasPreconnect, true);

      return `Hero LCP (fetchpriority=high, ${heroImgAttrs.heroWidth}x${heroImgAttrs.heroHeight}), Card (${heroImgAttrs.cardWidth}x${heroImgAttrs.cardHeight}, lazy/async) & preconnect verified`;
    });
  } finally {
    await browser.close();
  }

  console.log('\n' + '='.repeat(60));
  const passed = results.filter((r) => r.ok).length;
  console.log(`${passed}/${results.length} passed`);
  if (passed !== results.length) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
