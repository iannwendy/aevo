/**
 * Phase 6 E2E Verification Suite (Bonus Features)
 * Covers all test cases in docs/E2E_TEST_PLAN.md & docs/requirement.md (Section II.10):
 *   - Task 6.1 CI/CD Pipeline:              CICD-01 .. CICD-04
 *   - Task 6.2 Microservices Architecture:  MS-01   .. MS-05
 *   - Task 6.3 AI Features:                 AI-01   .. AI-06
 *   - Task 6.4 Elasticsearch Integration:   ES-01   .. ES-05
 *
 * Run with both API (3001) and Web (3000) servers up:
 *   node apps/api/test/phase6.e2e.js
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
  return { status: res.status, body: parsed, headers: res.headers };
}

async function launchBrowser() {
  try {
    return await chromium.launch({ headless: true, channel: 'chrome' });
  } catch {
    return await chromium.launch({ headless: true });
  }
}

// 1x1 valid PNG base64 sample for image upload testing
const SAMPLE_PNG_BASE64 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

async function waitForApiReady(maxWaitMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const res = await fetch(`${API}/health`);
      if (res.ok) return true;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function main() {
  console.log('\n=== PHASE 6: Bonus Features Full E2E Test Suite ===\n');
  await waitForApiReady();

  // ===========================================================================
  // TASK 6.1: CI/CD Pipeline (CICD-01 .. CICD-04)
  // ===========================================================================
  console.log('--- Task 6.1: CI/CD Pipeline (CICD-01 .. CICD-04) ---');

  const workflowPath = path.join(ROOT_DIR, '.github/workflows/ci-cd.yml');

  await test('CICD-01', 'GitHub Actions workflow exists and triggers on push & pull_request', async () => {
    assert.equal(fs.existsSync(workflowPath), true, 'Missing .github/workflows/ci-cd.yml');
    const content = fs.readFileSync(workflowPath, 'utf8');
    assert.match(content, /name:\s*AEVO E-Commerce CI\/CD Pipeline/i);
    assert.match(content, /push:/);
    assert.match(content, /pull_request:/);
    return '.github/workflows/ci-cd.yml verified with push & pull_request triggers';
  });

  await test('CICD-02', 'CI/CD workflow runs automated E2E tests against PostgreSQL & Redis services', async () => {
    const content = fs.readFileSync(workflowPath, 'utf8');
    assert.match(content, /postgres:16-alpine/);
    assert.match(content, /redis:7-alpine/);
    assert.match(content, /phase1\.e2e\.js/);
    assert.match(content, /phase6\.e2e\.js/);
    return 'PostgreSQL + Redis service containers & E2E suites configured';
  });

  await test('CICD-03', 'CI/CD build & Docker Compose configurations validate cleanly', async () => {
    execSync('docker compose -f docker-compose.yml config -q', { cwd: ROOT_DIR });
    execSync('docker compose -f docker-compose.yml -f docker-compose.scale.yml config -q', {
      cwd: ROOT_DIR,
    });
    execSync(
      'docker compose -f docker-compose.yml -f docker-compose.microservices.yml config -q',
      { cwd: ROOT_DIR }
    );
    return 'All 3 Docker Compose configurations (standard, scale, microservices) validated';
  });

  await test('CICD-04', 'CI/CD auto-deploy job is gated on main branch push after tests pass', async () => {
    const content = fs.readFileSync(workflowPath, 'utf8');
    assert.match(content, /deploy:/);
    assert.match(content, /needs:\s*\[lint-and-validate,\s*test-and-verify,\s*docker-build\]/);
    assert.match(content, /refs\/heads\/main/);
    return 'Deploy job gated on main push & upstream test/build completion';
  });

  // ===========================================================================
  // TASK 6.2: Microservices Architecture & Async Redis Communication (MS-01 .. MS-05)
  // ===========================================================================
  console.log('\n--- Task 6.2: Microservices Architecture (MS-01 .. MS-05) ---');

  await test('MS-01', 'Microservices topology has 3+ backend services (product, order, user) + API Gateway', async () => {
    const res = await apiCall('/api/microservices/status');
    assert.equal(res.status, 200);
    assert.equal(res.body.architecture, 'microservices');
    const serviceNames = (res.body.services || []).map((s) => s.name);
    for (const required of ['api-gateway', 'product-service', 'order-service', 'user-service']) {
      assert.ok(
        serviceNames.includes(required),
        `Missing microservice "${required}" in ${serviceNames.join(', ')}`
      );
    }
    return `${res.body.services.length} services active: ${serviceNames.join(', ')}`;
  });

  await test('MS-02', 'Service separation: each microservice defines isolated domain routes & event subscriptions', async () => {
    const res = await apiCall('/api/microservices/status');
    assert.equal(res.status, 200);
    const byName = Object.fromEntries((res.body.services || []).map((s) => [s.name, s]));
    assert.ok(byName['product-service'].routes.includes('/api/products'));
    assert.ok(byName['order-service'].routes.includes('/api/orders'));
    assert.ok(byName['user-service'].routes.includes('/api/users'));
    assert.equal(byName['product-service'].status, 'healthy');
    assert.equal(byName['order-service'].status, 'healthy');
    assert.equal(byName['user-service'].status, 'healthy');
    return 'product-service, order-service, and user-service healthy & separated';
  });

  await test('MS-03', 'API Gateway routes requests to target microservices with gateway headers', async () => {
    for (const svc of ['product-service', 'order-service', 'user-service']) {
      const res = await apiCall(`/api/gateway/proxy/${svc}/health`);
      assert.equal(res.status, 200);
      assert.equal(res.body.routedTo, svc);
      assert.equal(res.headers.get('x-gateway-routed-to'), svc);
    }
    return 'Verified API Gateway routing to product-service, order-service, user-service';
  });

  await test('MS-04', 'Asynchronous communication & decoupling over Redis Pub/Sub intermediary channel', async () => {
    const res = await apiCall('/api/microservices/events/publish', {
      method: 'POST',
      body: {
        type: 'INVENTORY_SYNC',
        payload: { source: 'phase6-e2e-test', timestamp: Date.now() },
        awaitAck: true,
      },
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.status, 'processed');
    assert.equal(res.body.event.channel, 'aevo:events:bus');
    assert.equal(res.body.receipt.status, 'PROCESSED');
    assert.equal(res.body.receipt.consumerService, 'product-service');
    return `Event ${res.body.event.eventId} published on ${res.body.event.channel} -> ACK by ${res.body.receipt.consumerService} (${res.body.receipt.latencyMs}ms)`;
  });

  await test('MS-05', 'Event history ledger records asynchronous cross-service domain events', async () => {
    await apiCall('/api/microservices/events/publish', {
      method: 'POST',
      body: {
        type: 'LOYALTY_UPDATED',
        payload: { userId: 'test-user', pointsDelta: 100 },
        awaitAck: true,
      },
    });

    const hist = await apiCall('/api/microservices/events/history?limit=10');
    assert.equal(hist.status, 200);
    assert.ok(Array.isArray(hist.body.events) && hist.body.events.length >= 2);
    const hasLoyalty = hist.body.events.some(
      (e) => e.type === 'LOYALTY_UPDATED' && e.status === 'PROCESSED'
    );
    assert.equal(hasLoyalty, true, 'Expected LOYALTY_UPDATED receipt in event history');
    return `${hist.body.events.length} async receipts verified in Redis event history`;
  });

  // ===========================================================================
  // TASK 6.3: AI Features (AI-01 .. AI-06)
  // ===========================================================================
  console.log('\n--- Task 6.3: AI Features (AI-01 .. AI-06) ---');

  await test('AI-01', 'AI Product Recommendation Chatbot suggests real in-stock hardware (VI & EN)', async () => {
    const viRes = await apiCall('/api/ai/chat', {
      method: 'POST',
      body: {
        message: 'Tư vấn cho mình laptop lập trình dưới 45 triệu',
        locale: 'vi',
      },
    });
    assert.equal(viRes.status, 200);
    assert.equal(viRes.body.intent.language, 'vi');
    assert.equal(viRes.body.intent.detectedCategory, 'laptops');
    assert.equal(viRes.body.intent.maxBudget, 45000000);
    assert.ok(
      Array.isArray(viRes.body.recommendations) && viRes.body.recommendations.length > 0,
      'Expected non-empty product recommendations'
    );
    for (const rec of viRes.body.recommendations) {
      assert.ok(rec.price <= 45000000, `Expected recommended product price <= 45M, got ${rec.price}`);
      assert.ok(rec.slug && rec.name);
    }

    const enRes = await apiCall('/api/ai/chat', {
      method: 'POST',
      body: {
        message: 'Recommend a 4K OLED monitor for creators',
        locale: 'en',
      },
    });
    assert.equal(enRes.status, 200);
    assert.equal(enRes.body.intent.detectedCategory, 'monitors');
    assert.ok(enRes.body.recommendations.length > 0);
    return `VI laptop recs=${viRes.body.recommendations.length} (<=45M VND), EN monitor recs=${enRes.body.recommendations.length}`;
  });

  await test('AI-02', 'AI Product Search by Image Upload classifies hardware & returns ranked matches', async () => {
    const res = await apiCall('/api/ai/image-search', {
      method: 'POST',
      body: {
        imageBase64: SAMPLE_PNG_BASE64,
        fileName: 'asus-rog-rtx-4080-graphics-card.png',
        limit: 6,
      },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.detectedCategory, 'components');
    assert.equal(res.body.detectedBrand, 'ASUS');
    assert.ok(res.body.confidence >= 0.75);
    assert.ok(Array.isArray(res.body.visualLabels) && res.body.visualLabels.length >= 2);
    assert.ok(Array.isArray(res.body.products) && res.body.products.length > 0);
    assert.ok(res.body.products[0].similarityScore >= 0.8);
    return `Detected category="${res.body.detectedCategory}", brand="${res.body.detectedBrand}", matches=${res.body.products.length}`;
  });

  await test('AI-03', 'AI Sentiment Analysis classifies positive, negative & negation reviews (EN & VI)', async () => {
    const posRes = await apiCall('/api/ai/sentiment', {
      method: 'POST',
      body: {
        comment: 'Màn hình cực kỳ sắc nét, máy chạy rất mát, không nóng và rất đáng tiền!',
        rating: 5,
      },
    });
    assert.equal(posRes.status, 200);
    assert.equal(posRes.body.sentiment.label, 'POSITIVE');
    assert.ok(posRes.body.sentiment.score > 0.3);
    assert.ok(posRes.body.sentiment.aspects.includes('display'));
    assert.ok(posRes.body.sentiment.aspects.includes('thermals'));

    const negRes = await apiCall('/api/ai/sentiment', {
      method: 'POST',
      body: {
        comment: 'Quá nóng, quạt kêu to ồn và bị giật lag, rất thất vọng.',
        rating: 1,
      },
    });
    assert.equal(negRes.status, 200);
    assert.equal(negRes.body.sentiment.label, 'NEGATIVE');
    assert.ok(negRes.body.sentiment.score < -0.3);

    const batchRes = await apiCall('/api/ai/sentiment', {
      method: 'POST',
      body: {
        reviews: [
          { comment: 'Excellent build quality and blazing fast SSD!', rating: 5 },
          { comment: 'Terrible battery and overheating issue.', rating: 1 },
        ],
      },
    });
    assert.equal(batchRes.status, 200);
    assert.equal(batchRes.body.summary.positiveCount, 1);
    assert.equal(batchRes.body.summary.negativeCount, 1);
    return `Positive=${posRes.body.sentiment.score}, Negative=${negRes.body.sentiment.score}, Aspects=[${posRes.body.sentiment.aspects.join(', ')}]`;
  });

  // ===========================================================================
  // TASK 6.4: Elasticsearch Integration (ES-01 .. ES-05)
  // ===========================================================================
  console.log('\n--- Task 6.4: Elasticsearch Integration (ES-01 .. ES-05) ---');

  await test('ES-01', 'Elasticsearch setup & reindex: Cluster green and all active products indexed', async () => {
    const reindexRes = await apiCall('/api/search/reindex', { method: 'POST' });
    assert.equal(reindexRes.status, 200);
    assert.ok(reindexRes.body.indexed >= 100, `Expected >= 100 indexed products, got ${reindexRes.body.indexed}`);

    const healthRes = await apiCall('/api/search/health');
    assert.equal(healthRes.status, 200);
    assert.equal(healthRes.body.status, 'green');
    assert.equal(healthRes.body.indexedCount, reindexRes.body.indexed);
    return `Cluster status=${healthRes.body.status}, indexed=${healthRes.body.indexedCount} products in "${healthRes.body.index}"`;
  });

  await test('ES-02', 'Product search with Elasticsearch: BM25 relevance scoring & facet aggregations', async () => {
    const res = await apiCall('/api/search/elasticsearch?q=MacBook+Pro&limit=10');
    assert.equal(res.status, 200);
    assert.equal(res.body.engine, 'elasticsearch');
    assert.ok(res.body.totalHits > 0, 'Expected Elasticsearch hits for "MacBook Pro"');
    assert.ok(res.body.maxScore > 0, 'Expected positive BM25 _score');
    assert.ok(Array.isArray(res.body.aggregations?.brands), 'Expected brand aggregations');
    assert.match(res.body.products[0].name, /MacBook/i);
    return `Hits=${res.body.totalHits}, top="${res.body.products[0].name}" (_score=${res.body.maxScore}, took=${res.body.tookMs}ms)`;
  });

  await test('ES-03', 'Elasticsearch Fuzzy Typo Tolerance finds products despite misspelled keywords', async () => {
    const typoRes = await apiCall('/api/search/elasticsearch?q=macbok&fuzzy=true');
    assert.equal(typoRes.status, 200);
    assert.ok(typoRes.body.totalHits > 0, 'Expected fuzzy match for typo "macbok" -> "macbook"');
    assert.ok(
      typoRes.body.fuzzyCorrections.includes('macbook'),
      `Expected fuzzy correction "macbook", got: ${typoRes.body.fuzzyCorrections.join(', ')}`
    );
    return `Typo "macbok" corrected to [${typoRes.body.fuzzyCorrections.join(', ')}] -> ${typoRes.body.totalHits} hits`;
  });

  await test('ES-04', 'Elasticsearch Instant Autocomplete Suggestions (/api/search/suggest)', async () => {
    const res = await apiCall('/api/search/suggest?q=rtx&limit=5');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.suggestions) && res.body.suggestions.length > 0);
    return `Returned ${res.body.suggestions.length} instant suggestions for "rtx"`;
  });

  await test('ES-05', 'Performance comparison: Elasticsearch Inverted Index vs PostgreSQL ILIKE benchmark', async () => {
    const res = await apiCall('/api/search/benchmark?iterations=6');
    assert.equal(res.status, 200);
    assert.equal(res.body.fasterEngine, 'elasticsearch');
    assert.ok(res.body.elasticsearch.avgLatencyMs >= 0);
    assert.ok(res.body.postgresql.avgLatencyMs >= 0);
    assert.ok(res.body.speedupFactor >= 1.2);
    assert.ok(Array.isArray(res.body.queriesTested) && res.body.queriesTested.length >= 3);
    return `ES avg=${res.body.elasticsearch.avgLatencyMs}ms vs PG avg=${res.body.postgresql.avgLatencyMs}ms (${res.body.speedupFactor}x speedup)`;
  });

  // ===========================================================================
  // PLAYWRIGHT BROWSER UI VERIFICATION (AI-04 .. AI-06)
  // ===========================================================================
  console.log('\n--- Playwright Browser UI Verification (AI-04 .. AI-06) ---');

  const browser = await launchBrowser();
  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      locale: 'en-US',
    });
    const page = await context.newPage();

    await test('AI-04', 'Playwright UI: Floating AI Chatbot opens, sends query & renders product cards', async () => {
      await page.goto(`${CLIENT}/`, { waitUntil: 'networkidle' });
      const trigger = page.locator('[data-testid="ai-chatbot-trigger"]');
      assert.equal(await trigger.isVisible(), true, 'AI Chatbot trigger button should be visible on Home');
      await trigger.click();

      const panel = page.locator('[data-testid="ai-chatbot-panel"]');
      await panel.waitFor({ state: 'visible', timeout: 5000 });

      await page.locator('[data-testid="ai-chatbot-input"]').fill('Laptop for coding under 35M');
      await page.locator('[data-testid="ai-chatbot-send"]').click();

      await page.waitForSelector('[data-testid="ai-recommended-product-card"]', { timeout: 10000 });
      const recCount = await page.locator('[data-testid="ai-recommended-product-card"]').count();
      assert.ok(recCount >= 1, `Expected >= 1 recommended product card in AI chat, got ${recCount}`);

      await page.locator('[data-testid="ai-chatbot-close"]').click();
      return `AI Chatbot UI rendered ${recCount} clickable product recommendation cards`;
    });

    await test('AI-05', 'Playwright UI: Catalog Image Search modal analyzes visual sample & filters products', async () => {
      await page.goto(`${CLIENT}/products`, { waitUntil: 'networkidle' });
      const imgBtn = page.locator('[data-testid="image-search-trigger"]');
      await imgBtn.waitFor({ state: 'visible', timeout: 5000 });
      await imgBtn.click();

      const modal = page.locator('[data-testid="image-search-modal"]');
      await modal.waitFor({ state: 'visible', timeout: 5000 });

      await page.locator('[data-testid="image-search-sample-monitors"]').click();
      await page.waitForSelector('[data-testid="image-search-analysis"]', { timeout: 10000 });

      const resultCards = await page.locator('[data-testid="image-search-result-card"]').count();
      assert.ok(resultCards >= 1, 'Expected >= 1 matched product card in Image Search modal');

      await page.locator('[data-testid="image-search-apply-filter"]').click();
      await page.waitForURL(/category=monitors/i, { timeout: 5000 });
      return `Visual search detected "monitors", displayed ${resultCards} visual matches & applied catalog filter`;
    });

    await test('AI-06', 'Playwright UI: Product Detail shows AI Sentiment Summary & Review Sentiment Badges', async () => {
      const listRes = await apiCall('/api/products?limit=1');
      const firstSlug = listRes.body.products[0].slug;
      const firstId = listRes.body.products[0].id;

      // Ensure at least 1 positive guest comment exists on this product
      await apiCall('/api/reviews', {
        method: 'POST',
        body: {
          productId: firstId,
          guestName: 'AI Sentiment Verifier',
          comment: 'Excellent performance, super fast and runs very cool and quiet!',
        },
      });

      await page.goto(`${CLIENT}/products/${firstSlug}`, { waitUntil: 'networkidle' });
      const summary = page.locator('[data-testid="ai-sentiment-summary"]');
      await summary.waitFor({ state: 'visible', timeout: 8000 });

      const badgesCount = await page.locator('[data-testid="review-sentiment-badge"]').count();
      assert.ok(badgesCount >= 1, 'Expected >= 1 review sentiment badge on Product Detail');
      const firstBadgeSentiment = await page
        .locator('[data-testid="review-sentiment-badge"]')
        .first()
        .getAttribute('data-sentiment');
      assert.ok(
        ['POSITIVE', 'NEUTRAL', 'NEGATIVE'].includes(firstBadgeSentiment),
        `Unexpected sentiment attribute: ${firstBadgeSentiment}`
      );
      return `AI Sentiment Summary & ${badgesCount} review sentiment badges visible (top=${firstBadgeSentiment})`;
    });
  } finally {
    await browser.close();
  }

  // ===========================================================================
  // Summary
  // ===========================================================================
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n=== Phase 6 Summary: ${passed}/${results.length} PASSED (${failed} failed) ===\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error in Phase 6 E2E suite:', err);
  process.exit(1);
});
