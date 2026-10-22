# AEVO E-Commerce — Horizontal Scaling Architecture (Task 5.5)

## 1. Overview

AEVO is engineered as a **100% stateless API tier** (`apps/api`) backed by **Redis 7** and **PostgreSQL 16**, enabling zero-downtime horizontal scaling across multiple API instances behind any L7 load balancer (Nginx, AWS ALB, Cloudflare, or Kubernetes Ingress).

```
                     ┌──────────────────────────┐
                     │   Client Browser / Web   │
                     └────────────┬─────────────┘
                                  │
                                  ▼
                     ┌──────────────────────────┐
                     │   Nginx Load Balancer    │
                     │     (least_conn :3001)   │
                     └─────┬──────────────┬─────┘
                           │              │
              ┌────────────▼───┐      ┌───▼────────────┐
              │ API Instance 1 │      │ API Instance 2 │
              │ (Stateless)    │      │ (Stateless)    │
              └───────┬────────┘      └────────┬───────┘
                      │                        │
          ┌───────────┴───────────┬────────────┴───────────┐
          ▼                       ▼                        ▼
┌───────────────────┐   ┌───────────────────┐    ┌───────────────────┐
│   Redis 7 Store   │   │   Redis Pub/Sub   │    │   PostgreSQL 16   │
│  Session & Cart   │   │  Socket.IO Bridge │    │  Primary Storage  │
└───────────────────┘   └───────────────────┘    └───────────────────┘
```

---

## 2. Key Stateless Design Pillars (`SCALE-01` & `SCALE-02`)

1. **Stateless JWT Authentication (`apps/api/src/middleware/auth.js`)**
   - Authentication tokens are signed with `HS256` (`JWT_SECRET`) and sent via `httpOnly` cookie (`token`) or `Authorization: Bearer <token>`.
   - No local process memory is required to validate requests—any API replica can verify the JWT and check account status.

2. **Shared Session & Cart Caching in Redis (`apps/api/src/utils/redis.js`)**
   - Active user authentication state (`aevo:session:auth:<userId>`) and guest/customer cart state (`aevo:session:cart:<sessionId>`) are stored in Redis with automatic TTL expiration (`EX`).
   - If Redis is temporarily unreachable in local development, `redis.js` transparently falls back to an in-memory store without service interruption.

3. **Cross-Instance Socket.IO Realtime Broadcasts via Redis Pub/Sub**
   - Product review submissions (`POST /api/reviews`) publish `new-review` events to the Redis channel `aevo:socket:events`.
   - Every API instance subscribes to `aevo:socket:events` (`initSocketRedisBridge(io)`) and forwards events from peer instances to its local `product-<productId>` Socket.IO room subscribers.

4. **Instance Identification & Health Check (`/health`)**
   - Every response includes an `X-Instance-Id` HTTP header identifying which replica served the request.
   - `GET /health` reports live readiness of PostgreSQL, Redis, JWT auth mode, and stateless status:
     ```json
     {
       "status": "ok",
       "instanceId": "api-replica-1",
       "stateless": true,
       "authMode": "jwt",
       "database": "connected",
       "redis": {
         "connected": true,
         "status": "connected",
         "store": "redis"
       }
     }
     ```

---

## 3. Running Single-Command Docker Compose (`Task 5.3`)

```bash
# Start all 4 core services (web, api, db, redis)
docker compose up -d

# Check container health
docker compose ps

# Stop all services
docker compose down
```

---

## 4. Running Multi-Instance Load-Balanced Cluster (`Task 5.5`)

```bash
# Launch multi-replica API cluster (api-1, api-2) behind Nginx load balancer
docker compose -f docker-compose.yml -f docker-compose.scale.yml up -d

# Verify load balancing across instances (inspect X-Instance-Id header)
curl -i http://localhost:3001/health
```
