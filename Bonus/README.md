# AEVO E-Commerce — Bonus Features Documentation & Evidence (`+2.0 / 2.0 Points`)

This directory documents the **4 Bonus Features** (Section II.10 of `docs/requirement.md`) implemented in the AEVO Premium Computing E-Commerce platform, along with architecture diagrams, API endpoints, and automated E2E verification commands.

---

## Summary of Implemented Bonus Features

| # | Bonus Feature (`requirement.md` Section II.10) | Points | Implementation & Key Files | Verification Suite |
| :-: | :--- | :-: | :--- | :--- |
| **1** | **CI/CD Pipeline (GitHub Actions)** | `+0.5` | [`.github/workflows/ci-cd.yml`](../.github/workflows/ci-cd.yml) — Multi-stage pipeline: Schema & JS compliance validation, PostgreSQL/Redis service containers, E2E test execution on PR/push, Docker build verification, and automated production rollout on merge to `main`. | `CICD-01` .. `CICD-04` |
| **2** | **Microservices Architecture & Async Redis Messaging** | `+0.5` | [`docker-compose.yml`](../docker-compose.yml), [`docker-compose.microservices.yml`](../docker-compose.microservices.yml), [`service-runner.js`](../apps/api/src/microservices/service-runner.js), [`eventBus.js`](../apps/api/src/utils/eventBus.js) — Separate containers for `web`, `db`, `redis`, `api` (API Gateway `:3001`), `product-service` (`:3002`), `order-service` (`:3003`), `user-service` (`:3004`), and `elasticsearch` (`:9200`), decoupled via Redis Pub/Sub channel `aevo:events:bus`. | `MS-01` .. `MS-05` |
| **3** | **AI-Related Features (Chatbot, Image Search, Sentiment Analysis)** | `+0.5` | [`ai.routes.js`](../apps/api/src/modules/ai/ai.routes.js), [`sentiment.js`](../apps/api/src/utils/sentiment.js), [`AiAssistantWidget.js`](../apps/web/components/ai/AiAssistantWidget.js), [`CatalogClient.js`](../apps/web/components/product/CatalogClient.js), [`ProductDetailClient.js`](../apps/web/components/product/ProductDetailClient.js) — Bilingual (EN/VI) AI Hardware Advisor Chatbot, Visual Image Upload Search, and real-time Review Sentiment Analysis. | `AI-01` .. `AI-06` |
| **4** | **Elasticsearch Integration for Product Search** | `+0.5` | [`elasticsearch.js`](../apps/api/src/utils/elasticsearch.js), [`search.routes.js`](../apps/api/src/modules/search/search.routes.js) — Inverted-index BM25 relevance ranking, multi-field boosting, Levenshtein fuzzy typo tolerance, instant autocomplete suggestions, and live PostgreSQL `ILIKE` vs Elasticsearch performance benchmark. | `ES-01` .. `ES-05` |

---

## 1. CI/CD Pipeline during Development (`+0.5 pts`)

### Architecture & Workflow Stages (`.github/workflows/ci-cd.yml`)
1. **Stage 1 (`lint-and-validate`)**:
   - Checks out code, configures Node.js 20 with npm cache, installs workspace packages.
   - Enforces the strict JavaScript-only rule (verifies `0` `.ts`/`.tsx` files in `apps/`).
   - Validates Prisma schema (`npx prisma validate`) and all 3 Docker Compose configurations (`docker compose config -q`).
2. **Stage 2 (`test-and-verify`)**:
   - Provisions ephemeral `postgres:16-alpine` and `redis:7-alpine` service containers with healthchecks.
   - Runs `prisma db push` and seeds the 187-product computer hardware catalog.
   - Builds the Next.js production bundle (`npm run build --workspace=apps/web`).
   - Starts the microservices, Elasticsearch node, API Gateway, and Next.js server, and executes the automated E2E suites (`phase1` through `phase6` + `security`).
3. **Stage 3 (`docker-build`)**:
   - Verifies production Docker image builds for `api` and `web` using Docker Buildx.
4. **Stage 4 (`deploy`)**:
   - Automatically triggers production deployment when changes are merged into `main` and all upstream verification jobs pass.

---

## 2. Microservices Architecture & Asynchronous Communication (`+0.5 pts`)

### Service Topology
In addition to the **Next.js Frontend (`web`)** and **PostgreSQL Database (`db`)**, the system deploys **6 backend/infrastructure services**:
1. **`api` (`:3001`)** — **API Gateway & Orchestrator**: Entrypoint, JWT authentication, Socket.IO realtime gateway, and `/api/gateway/proxy/:service/*` router.
2. **`product-service` (`:3002`)** — **Product & Catalog Microservice**: Handles `/api/products`, `/api/categories`, `/api/reviews`, inventory updates, and Elasticsearch synchronization.
3. **`order-service` (`:3003`)** — **Order & Checkout Microservice**: Handles `/api/orders`, `/api/cart`, `/api/discounts`, and asynchronous order confirmation/audit processing.
4. **`user-service` (`:3004`)** — **User & Loyalty Microservice**: Handles `/api/auth`, `/api/users`, `/api/loyalty`, address management, and loyalty point ledger synchronization.
5. **`elasticsearch` (`:9200`)** — **Dedicated Search Engine Node**: Handles inverted-index BM25 product search and bulk indexing.
6. **`redis` (`:6379`)** — **Intermediary Asynchronous Message Broker**: Powers decoupled Redis Pub/Sub channels (`aevo:events:bus` and `aevo:events:acks`) and persistent event ledger (`aevo:events:history`).

### Asynchronous Event Flow (Decoupling via Redis)
- When an order is placed (`POST /api/orders`), the API publishes `ORDER_CREATED` and `LOYALTY_UPDATED` events onto Redis channel `aevo:events:bus`.
- `product-service` asynchronously consumes `ORDER_CREATED` / `ORDER_CANCELLED` to refresh variant inventory and re-index affected products in Elasticsearch.
- `order-service` asynchronously consumes `ORDER_CREATED` / `ORDER_STATUS_CHANGED` to record audit receipts.
- `user-service` asynchronously consumes `LOYALTY_UPDATED` and `REVIEW_SUBMITTED` to synchronize customer loyalty balances and index review sentiment.

### Verification Endpoints
- `GET /api/microservices/status` — Live status of all microservices, routes, subscribed channels, and Redis broker.
- `POST /api/microservices/events/publish` — Publish a domain event over Redis and receive the asynchronous consumer `ACK` receipt.
- `GET /api/microservices/events/history` — Inspect processed asynchronous event receipts and latency metrics.

---

## 3. AI-Related Features (`+0.5 pts`)

### 3.1. AEVO Intelligence v2 — Multi-Turn Agentic AI Concierge & Hardware Advisor
- **Backend**: `POST /api/ai/chat` ([`ai.routes.js`](../apps/api/src/modules/ai/ai.routes.js)) — Hybrid Google Gemini LLM + Deterministic Multi-Turn Agentic RAG Engine backed by Elasticsearch BM25 and PostgreSQL.
- **Frontend**: Floating [`AiAssistantWidget`](../apps/web/components/ai/AiAssistantWidget.js) (`[data-testid="ai-chatbot-trigger"]`) with Expand/Compact studio view, custom Rich Markdown & Table renderer, `sessionStorage` multi-turn persistence, and 1-click **Quick Add to Cart** (`+ Giỏ` / `+ Add`).
- **Key Highlights**:
  1. **Multi-Turn Memory & Product Page Context**: Tracks conversation history for follow-up queries (*"So sánh 2 mẫu đầu tiên"*, *"Còn mẫu nào rẻ hơn không?"*) and automatically detects the active `/products/[slug]` page to offer instant product analysis.
  2. **Variant-Level SKU & Budget Matching**: Parses flexible Vietnamese & English budget expressions (*"dưới 45 triệu"*, *"từ 25 đến 40 triệu"*, *"tầm 30 triệu"*), selects the optimal in-stock `ProductVariant` within budget, and highlights discount percentages and technical specs.
  3. **Side-by-Side Spec Comparison Matrix**: Renders structured Markdown comparison tables (`| Spec | Model A | Model B |`) comparing brands, starting prices, featured configurations, star ratings, and specialist recommendations.
  4. **Workspace Setup / Bundle Builder**: Intelligently allocates total budgets across complementary categories (*Laptops + Monitors + Peripherals*), calculating bundle totals and **10% Loyalty Points** earned.
  5. **Live Promo Codes, Loyalty Balance & Order Tracking**: Queries PostgreSQL live to display active 5-character discount codes (`remaining / maxUses`), authenticated user Loyalty Points, and real-time order tracking by order number (`AEVO-...`).

### 3.2. Product Search by Image Upload
- **Backend**: `POST /api/ai/image-search`
- **Frontend**: Visual Search button (`[data-testid="image-search-trigger"]`) & Upload Modal (`[data-testid="image-search-modal"]`) in `/products`.
- **Capabilities**: Parses uploaded PNG/JPEG/WebP images (dimensions, aspect ratio, studio luminance signature, and visual metadata), detects the matching computer hardware category & brand cues, and returns ranked visual matches with similarity confidence scores.

### 3.3. Review Sentiment Analysis
- **Backend**: `POST /api/ai/sentiment`, `GET /api/ai/sentiment/product/:productId`, and automatic enrichment on `GET /api/reviews/product/:productId` & `POST /api/reviews`.
- **Frontend**: AI Sentiment Summary card (`[data-testid="ai-sentiment-summary"]`) and per-review Sentiment Badges (`[data-testid="review-sentiment-badge"]`) on `/products/[slug]`.
- **Capabilities**: Bilingual (EN/VI) hardware lexicon analyzer with negation handling (e.g., *"rất mát, không nóng"*, *"not bad"*) and aspect extraction (`performance`, `thermals`, `display`, `build_quality`, `value`, `battery`).

---

## 4. Elasticsearch Integration for Product Search (`+0.5 pts`)

### Capabilities & Endpoints
- `GET /api/search/elasticsearch?q=...&fuzzy=true` — Executes BM25 multi-field search (`name^4`, `brand^3.5`, `tags^2.5`, `category^2`, `description^1`) with Levenshtein fuzzy typo tolerance (e.g., `"macbok"` automatically matches `"MacBook"`), boolean filters, and facet aggregations (`brands`, `categories`, `priceStats`).
- `GET /api/search/suggest?q=...` — Sub-millisecond prefix & edge-ngram autocomplete suggestions.
- `POST /api/search/reindex` — Bulk-synchronizes all 187 active PostgreSQL products into the `aevo_products` index.
- `GET /api/search/benchmark` — Runs a multi-iteration performance benchmark comparing **Elasticsearch Inverted Index Search** vs **PostgreSQL `ILIKE` Sequential Scan**, returning average, min, max, P95 latencies and speedup factor.

---

## Running the Automated Phase 6 Verification Suite

```bash
# Ensure Docker Compose stack is up
docker compose up -d

# Run the 20-test Phase 6 Bonus E2E Suite (CICD, Microservices, AI, Elasticsearch + Playwright UI)
node apps/api/test/phase6.e2e.js
```
