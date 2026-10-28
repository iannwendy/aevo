================================================================================
AEVO — PREMIUM COMPUTING & PC HARDWARE E-COMMERCE PLATFORM
Course: Web Programming with Node.js (502070) — Final Project
================================================================================

1. QUICK START (SINGLE-COMMAND DOCKER COMPOSE DEPLOYMENT)
--------------------------------------------------------------------------------
To build and launch the complete 8-container AEVO stack (Next.js Storefront &
Admin UI, Express.js API Gateway, 3 Domain Microservices, Elasticsearch Node,
PostgreSQL 16, and Redis 7) with automatic Prisma schema sync and 187-product
hardware catalog seeding, run:

    docker compose up -d

(Or `docker compose up -d --build` if rebuilding images from source).

Once started, access the application at:
  - Storefront (AEVO Store):       http://localhost:3000
  - Admin Panel (AEVO Control):    http://localhost:3000/admin
  - Backend API Gateway Health:    http://localhost:3001/health
  - Microservices Topology Status: http://localhost:3001/api/microservices/status
  - Elasticsearch Cluster Health:  http://localhost:9200/_cluster/health


2. PRE-SEEDED ACCOUNTS FOR GRADING & EVALUATION
--------------------------------------------------------------------------------
  [Administrator Account — Single Admin Enforced]
  - Email:      admin@aevo.com
  - Password:   admin123
  - Dashboard:  http://localhost:3000/admin

  [Customer Account 1 — Pre-loaded with Loyalty Points & Verified Reviews]
  - Email:      customer@aevo.com
  - Password:   customer123

  [Customer Account 2 — Pre-configured with Default Delivery Address]
  - Email:      customer2@aevo.com
  - Password:   customer123


3. PRE-SEEDED 5-CHARACTER DISCOUNT CODES (MAX 10 USES, NO EXPIRATION)
--------------------------------------------------------------------------------
  - AEV10 : 10% OFF any computer hardware order (Max 10 uses)
  - SAV20 : 20% OFF orders over 5,000,000 VND (Max 10 uses)
  - VIP15 : 15% OFF shipping-inclusive orders (Max 10 uses)
  - NEW50 : 500,000 VND OFF for new customers (Max 10 uses)
  - PRO1M : 1,000,000 VND OFF workstation hardware (Max 10 uses)


4. BONUS FEATURES IMPLEMENTED (+2.0 / 2.0 POINTS)
--------------------------------------------------------------------------------
Full technical documentation and verification commands are located in `Bonus/README.md`:

  [1] CI/CD Pipeline (+0.5 pts):
      - `.github/workflows/ci-cd.yml` (4-stage GitHub Actions pipeline:
        pure JS validation, Prisma & Docker Compose checks, PostgreSQL/Redis
        service containers + E2E test execution, Docker build, and deploy).

  [2] Microservices Architecture & Async Redis Messaging (+0.5 pts):
      - 8 Docker containers (`web`, `api` Gateway :3001, `product-service` :3002,
        `order-service` :3003, `user-service` :3004, `elasticsearch` :9200,
        `redis` :6379, `db` :5434) decoupled via Redis Pub/Sub (`aevo:events:bus`).

  [3] AI-Powered Commerce Suite (+0.5 pts):
      - Smart Product Recommendation Chatbot (`POST /api/ai/chat` + floating UI)
      - Visual Product Search by Image Upload (`POST /api/ai/image-search`)
      - Bilingual Review Sentiment & Aspect Analysis (`POST /api/ai/sentiment`)

  [4] Elasticsearch Integration for Product Search (+0.5 pts):
      - Inverted-index BM25 ranking with field boosting, Levenshtein fuzzy typo
        tolerance (`GET /api/search/elasticsearch`), edge-ngram autocomplete
        (`GET /api/search/suggest`), and live ES vs PostgreSQL benchmark
        (`GET /api/search/benchmark`).


5. HORIZONTAL SCALING (MULTI-INSTANCE STATELESS API + NGINX LOAD BALANCER)
--------------------------------------------------------------------------------
To launch multiple stateless API replicas (`api-1`, `api-2`) behind the Nginx
`least_conn` load balancer:

    docker compose -f docker-compose.yml -f docker-compose.scale.yml up -d --build
    curl -i http://localhost:3001/health
================================================================================
