/**
 * Standalone Microservice & Search Engine Runner
 * Launches an isolated Express service container based on SERVICE_ROLE:
 *   - product-service (port 3002): Product Catalog, Variants, Categories, Reviews, Search Sync
 *   - order-service   (port 3003): Orders, Checkout, Cart, Discounts, Async Order Events
 *   - user-service    (port 3004): Auth, Users, Profile, Addresses, Loyalty Points
 *   - elasticsearch   (port 9200): Elasticsearch 8 Compatible Inverted-Index Search Server
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const prisma = require('../utils/prisma');
const { isAllowedOrigin } = require('../config/origins');
const { sanitizeRequest } = require('../utils/security');
const { errorHandler, notFoundHandler } = require('../middleware/errorHandler');
const { INSTANCE_ID, getRedisStatus } = require('../utils/redis');
const { EVENT_CHANNEL, getEventHistory } = require('../utils/eventBus');
const { registerAllDomainConsumers } = require('./domain-consumers');
const {
  ES_INDEX_NAME,
  localIndex,
  verifyInternalSyncToken,
  syncAllProductsToElasticsearch,
} = require('../utils/elasticsearch');

const SERVICE_ROLE = (process.env.SERVICE_ROLE || 'product-service').toLowerCase();

const DEFAULT_PORTS = {
  'product-service': 3002,
  'order-service': 3003,
  'user-service': 3004,
  elasticsearch: 9200,
};

const PORT = Number(process.env.PORT || DEFAULT_PORTS[SERVICE_ROLE] || 3002);

async function startElasticsearchNode() {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(
    cors({
      origin: (origin, callback) => callback(null, isAllowedOrigin(origin)),
      credentials: true,
    })
  );
  app.use(express.json({ limit: '2mb' }));
  app.use(sanitizeRequest);

  // Initial sync from PostgreSQL on startup
  syncAllProductsToElasticsearch().catch(() => {});

  app.get('/', (req, res) => {
    res.json({
      name: `aevo-es-node-${INSTANCE_ID}`,
      cluster_name: 'aevo-es-cluster',
      cluster_uuid: 'aevo-es-uuid-2026',
      version: {
        number: '8.15.0',
        build_flavor: 'default',
        lucene_version: '9.11.1',
      },
      tagline: 'You Know, for Search',
    });
  });

  app.get('/_cluster/health', (req, res) => {
    res.json({
      cluster_name: 'aevo-es-cluster',
      status: 'green',
      timed_out: false,
      number_of_nodes: 1,
      number_of_data_nodes: 1,
      active_primary_shards: 1,
      active_shards: 1,
      indexed_documents: localIndex.documents.size,
      last_indexed_at: localIndex.lastIndexedAt,
    });
  });

  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'elasticsearch',
      instanceId: INSTANCE_ID,
      index: ES_INDEX_NAME,
      indexedDocuments: localIndex.documents.size,
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/:index/_count', (req, res) => {
    res.json({
      count: localIndex.documents.size,
      _shards: { total: 1, successful: 1, skipped: 0, failed: 0 },
    });
  });

  const requireInternalSyncAuth = (req, res, next) => {
    if (!verifyInternalSyncToken(req.headers['x-internal-sync-token'])) {
      return res.status(403).json({ error: 'Internal search index write token required' });
    }
    return next();
  };

  app.post('/:index/_bulk_sync', requireInternalSyncAuth, (req, res) => {
    const docs = Array.isArray(req.body?.documents) ? req.body.documents.slice(0, 1000) : [];
    localIndex.clear();
    const result = localIndex.bulkIndex(docs);
    res.json({ errors: false, ...result });
  });

  app.put('/:index/_doc/:id', requireInternalSyncAuth, (req, res) => {
    const { id } = req.params;
    localIndex.indexDocument(id, { ...req.body, id });
    res.json({ _index: req.params.index, _id: id, result: 'updated' });
  });

  app.delete('/:index/_doc/:id', requireInternalSyncAuth, (req, res) => {
    const { id } = req.params;
    const removed = localIndex.removeDocument(id);
    res.json({ _index: req.params.index, _id: id, result: removed ? 'deleted' : 'not_found' });
  });

  app.post('/:index/_search', async (req, res) => {
    if (localIndex.documents.size === 0) {
      await syncAllProductsToElasticsearch().catch(() => {});
    }
    const queryParams = { ...req.query, ...req.body };
    const result = localIndex.search(queryParams);
    res.json(result);
  });

  app.get('/:index/_search', async (req, res) => {
    if (localIndex.documents.size === 0) {
      await syncAllProductsToElasticsearch().catch(() => {});
    }
    const result = localIndex.search(req.query);
    res.json(result);
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  app.listen(PORT, () => {
    console.log(`[elasticsearch] Search engine node listening on port ${PORT}`);
  });
}

async function startDomainMicroservice() {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(
    cors({
      origin: (origin, callback) => callback(null, isAllowedOrigin(origin)),
      credentials: true,
    })
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: true, limit: '100kb' }));
  app.use(cookieParser());
  app.use(sanitizeRequest);

  app.use((req, res, next) => {
    res.setHeader('X-Microservice-Name', SERVICE_ROLE);
    res.setHeader('X-Instance-Id', INSTANCE_ID);
    next();
  });

  // Register Redis Pub/Sub async consumers for this microservice
  await registerAllDomainConsumers(SERVICE_ROLE);

  // Mount service-specific domain routes
  if (SERVICE_ROLE === 'product-service') {
    const productRoutes = require('../modules/products/products.routes');
    const categoryRoutes = require('../modules/categories/categories.routes');
    const reviewRoutes = require('../modules/reviews/reviews.routes');
    app.use('/api/products', productRoutes);
    app.use('/api/categories', categoryRoutes);
    app.use('/api/reviews', reviewRoutes);
    syncAllProductsToElasticsearch().catch(() => {});
  } else if (SERVICE_ROLE === 'order-service') {
    const orderRoutes = require('../modules/orders/orders.routes');
    const cartRoutes = require('../modules/cart/cart.routes');
    const discountRoutes = require('../modules/discounts/discounts.routes');
    app.use('/api/orders', orderRoutes);
    app.use('/api/cart', cartRoutes);
    app.use('/api/discounts', discountRoutes);
  } else if (SERVICE_ROLE === 'user-service') {
    const authRoutes = require('../modules/auth/auth.routes');
    const userRoutes = require('../modules/users/users.routes');
    const loyaltyRoutes = require('../modules/loyalty/loyalty.routes');
    app.use('/api/auth', authRoutes);
    app.use('/api/users', userRoutes);
    app.use('/api/loyalty', loyaltyRoutes);
  }

  app.get('/health', async (req, res) => {
    let dbStatus = 'connected';
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      dbStatus = 'disconnected';
    }
    const recentEvents = await getEventHistory(5);
    res.json({
      status: 'ok',
      service: SERVICE_ROLE,
      instanceId: INSTANCE_ID,
      port: PORT,
      database: dbStatus,
      redis: getRedisStatus(),
      eventBusChannel: EVENT_CHANNEL,
      recentEventsProcessed: recentEvents.filter((e) => e.consumerService === SERVICE_ROLE)
        .length,
      timestamp: new Date().toISOString(),
    });
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  app.listen(PORT, () => {
    console.log(`[microservice:${SERVICE_ROLE}] running on port ${PORT} (instance: ${INSTANCE_ID})`);
  });
}

if (SERVICE_ROLE === 'elasticsearch') {
  startElasticsearchNode();
} else {
  startDomainMicroservice();
}
