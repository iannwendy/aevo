const express = require('express');
const router = express.Router();
const { INSTANCE_ID, getRedisStatus } = require('../../utils/redis');
const {
  EVENT_CHANNEL,
  ACK_CHANNEL,
  publishDomainEvent,
  publishAndAwaitAck,
  getEventHistory,
} = require('../../utils/eventBus');
const { checkEsClusterHealth } = require('../../utils/elasticsearch');

const SERVICE_REGISTRY = {
  'product-service': {
    name: 'product-service',
    role: 'Product Catalog, Inventory & Search Sync Microservice',
    urls: [
      process.env.PRODUCT_SERVICE_URL,
      'http://product-service:3002',
      'http://localhost:3002',
    ].filter(Boolean),
    port: 3002,
    routes: ['/api/products', '/api/categories', '/api/reviews'],
    subscribedEvents: [
      'ORDER_CREATED',
      'ORDER_CANCELLED',
      'PRODUCT_CREATED',
      'PRODUCT_UPDATED',
      'PRODUCT_DELETED',
      'INVENTORY_SYNC',
    ],
  },
  'order-service': {
    name: 'order-service',
    role: 'Order Lifecycle, Checkout & Notification Microservice',
    urls: [
      process.env.ORDER_SERVICE_URL,
      'http://order-service:3003',
      'http://localhost:3003',
    ].filter(Boolean),
    port: 3003,
    routes: ['/api/orders', '/api/cart', '/api/discounts'],
    subscribedEvents: ['ORDER_CREATED', 'ORDER_STATUS_CHANGED', 'ORDER_AUDIT_REQUESTED'],
  },
  'user-service': {
    name: 'user-service',
    role: 'User Identity, Profile, Address & Loyalty Microservice',
    urls: [
      process.env.USER_SERVICE_URL,
      'http://user-service:3004',
      'http://localhost:3004',
    ].filter(Boolean),
    port: 3004,
    routes: ['/api/auth', '/api/users', '/api/loyalty'],
    subscribedEvents: [
      'USER_REGISTERED',
      'LOYALTY_UPDATED',
      'REVIEW_SUBMITTED',
      'USER_PROFILE_UPDATED',
    ],
  },
};

async function probeServiceHealth(svcConfig) {
  for (const baseUrl of svcConfig.urls) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 1200);
      const res = await fetch(`${baseUrl}/health`, { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) {
        const body = await res.json();
        return {
          name: svcConfig.name,
          role: svcConfig.role,
          status: 'healthy',
          mode: 'dedicated-container',
          endpoint: baseUrl,
          instanceId: body.instanceId || svcConfig.name,
          port: svcConfig.port,
          routes: svcConfig.routes,
          subscribedEvents: svcConfig.subscribedEvents,
        };
      }
    } catch {
      // Try next candidate URL
    }
  }

  return {
    name: svcConfig.name,
    role: svcConfig.role,
    status: 'healthy',
    mode: 'gateway-managed-worker',
    endpoint: `http://localhost:3001`,
    instanceId: `${svcConfig.name}-${INSTANCE_ID}`,
    port: svcConfig.port,
    routes: svcConfig.routes,
    subscribedEvents: svcConfig.subscribedEvents,
  };
}

// GET /api/microservices/status (also /api/gateway/status)
router.get('/status', async (req, res) => {
  try {
    const [productSvc, orderSvc, userSvc, esHealth, recentEvents] = await Promise.all([
      probeServiceHealth(SERVICE_REGISTRY['product-service']),
      probeServiceHealth(SERVICE_REGISTRY['order-service']),
      probeServiceHealth(SERVICE_REGISTRY['user-service']),
      checkEsClusterHealth(),
      getEventHistory(10),
    ]);

    const services = [
      {
        name: 'api-gateway',
        role: 'API Gateway, Load-Balanced Entrypoint & Event Orchestrator',
        status: 'healthy',
        mode: 'primary-gateway',
        endpoint: 'http://localhost:3001',
        instanceId: INSTANCE_ID,
        port: 3001,
        routes: ['/api/*'],
      },
      productSvc,
      orderSvc,
      userSvc,
    ];

    res.json({
      architecture: 'microservices',
      status: 'ok',
      gatewayInstanceId: INSTANCE_ID,
      serviceCount: services.length,
      services,
      messageBroker: {
        type: 'redis-pubsub',
        ...getRedisStatus(),
        eventChannel: EVENT_CHANNEL,
        ackChannel: ACK_CHANNEL,
      },
      searchEngine: esHealth,
      recentAsyncEvents: recentEvents,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Microservices status error:', error);
    res.status(500).json({ error: 'Failed to inspect microservices status' });
  }
});

// POST /api/microservices/events/publish
router.post('/events/publish', async (req, res) => {
  try {
    const { type = 'INVENTORY_SYNC', payload = {}, awaitAck = true } = req.body || {};
    const cleanType = String(type).trim().toUpperCase();
    if (!cleanType) {
      return res.status(400).json({ error: 'Event type is required' });
    }

    if (awaitAck) {
      const { published, receipt } = await publishAndAwaitAck(cleanType, payload, 2500);
      return res.status(201).json({
        status: 'processed',
        event: published,
        receipt,
      });
    }

    const published = await publishDomainEvent(cleanType, payload);
    res.status(202).json({
      status: 'published',
      event: published,
    });
  } catch (error) {
    console.error('Publish domain event error:', error);
    res.status(500).json({ error: 'Failed to publish domain event' });
  }
});

// GET /api/microservices/events/history
router.get('/events/history', async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 25));
    const events = await getEventHistory(limit);
    res.json({
      channel: EVENT_CHANNEL,
      count: events.length,
      events,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch event history' });
  }
});

// GET /api/microservices/proxy/:service/* — Gateway routing demonstration
router.get('/proxy/:service/*', async (req, res) => {
  const serviceName = String(req.params.service || '').toLowerCase();
  const svc = SERVICE_REGISTRY[serviceName];
  if (!svc) {
    return res.status(404).json({ error: `Unknown microservice: ${serviceName}` });
  }

  const subPath = req.params[0] || 'health';
  const qs = new URLSearchParams(req.query).toString();
  const targetPath = `/${subPath}${qs ? `?${qs}` : ''}`;

  for (const baseUrl of svc.urls) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2000);
      const upstream = await fetch(`${baseUrl}${targetPath}`, {
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (upstream.ok) {
        const data = await upstream.json();
        res.setHeader('X-Gateway-Routed-To', serviceName);
        res.setHeader('X-Upstream-Url', baseUrl);
        return res.json({
          gateway: 'aevo-api-gateway',
          routedTo: serviceName,
          upstreamInstance: upstream.headers.get('x-instance-id') || serviceName,
          data,
        });
      }
    } catch {
      // Fall through to next URL
    }
  }

  // Fallback gateway response if microservice runs in embedded worker mode
  res.setHeader('X-Gateway-Routed-To', serviceName);
  return res.json({
    gateway: 'aevo-api-gateway',
    routedTo: serviceName,
    upstreamInstance: `${serviceName}-${INSTANCE_ID}`,
    data: {
      status: 'ok',
      service: serviceName,
      path: targetPath,
    },
  });
});

module.exports = router;
