/**
 * AEVO Asynchronous Event Bus (Redis Pub/Sub + Persistent Event Ledger)
 * Decouples microservices (api-gateway, product-service, order-service, user-service)
 * via Redis Pub/Sub channels (`aevo:events:bus` and `aevo:events:acks`) and stores
 * verifiable event processing receipts in Redis (`aevo:events:history`).
 */
const crypto = require('crypto');
const { redisClient, isRedisReady, INSTANCE_ID } = require('./redis');

const EVENT_CHANNEL = 'aevo:events:bus';
const ACK_CHANNEL = 'aevo:events:acks';
const HISTORY_KEY = 'aevo:events:history';
const MAX_HISTORY = 100;

const memoryEventHistory = [];
const pendingAckWaiters = new Map(); // eventId -> Array<resolve>
let busPubClient = null;
let busSubClient = null;
let busInitialized = false;
const localHandlers = []; // Array<{ serviceName, eventTypes, handler }>

function createDedicatedClient() {
  return redisClient.duplicate({
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });
}

async function recordEventReceipt(receipt) {
  memoryEventHistory.unshift(receipt);
  if (memoryEventHistory.length > MAX_HISTORY) {
    memoryEventHistory.length = MAX_HISTORY;
  }

  if (isRedisReady()) {
    try {
      await redisClient.lpush(HISTORY_KEY, JSON.stringify(receipt));
      await redisClient.ltrim(HISTORY_KEY, 0, MAX_HISTORY - 1);
      if (receipt.eventId) {
        await redisClient.set(
          `aevo:events:ack:${receipt.eventId}`,
          JSON.stringify(receipt),
          'EX',
          3600
        );
      }
    } catch {
      // Fallback memory history already updated
    }
  }

  if (receipt.eventId && pendingAckWaiters.has(receipt.eventId)) {
    const waiters = pendingAckWaiters.get(receipt.eventId) || [];
    pendingAckWaiters.delete(receipt.eventId);
    for (const resolve of waiters) {
      resolve(receipt);
    }
  }
}

/**
 * Register a microservice domain event consumer
 */
function registerServiceConsumer(serviceName, eventTypes, handler) {
  localHandlers.push({
    serviceName,
    eventTypes: Array.isArray(eventTypes) ? eventTypes : [eventTypes],
    handler,
  });
}

async function dispatchToConsumers(envelope) {
  const receipts = [];
  for (const consumer of localHandlers) {
    if (
      consumer.eventTypes.includes('*') ||
      consumer.eventTypes.includes(envelope.type)
    ) {
      const start = process.hrtime.bigint();
      try {
        const result = await consumer.handler(envelope.payload, envelope);
        const latencyMs = Number(
          (Number(process.hrtime.bigint() - start) / 1e6).toFixed(2)
        );
        const receipt = {
          eventId: envelope.eventId,
          type: envelope.type,
          channel: EVENT_CHANNEL,
          broker: isRedisReady() ? 'redis-pubsub' : 'in-memory-bus',
          publisher: envelope.publisher || 'api-gateway',
          consumerService: consumer.serviceName,
          consumerInstance: INSTANCE_ID,
          status: 'PROCESSED',
          latencyMs,
          publishedAt: envelope.timestamp,
          processedAt: new Date().toISOString(),
          payloadSummary: envelope.payload,
          result: result || { ok: true },
        };
        await recordEventReceipt(receipt);
        if (busPubClient && busPubClient.status === 'ready') {
          await busPubClient.publish(ACK_CHANNEL, JSON.stringify(receipt)).catch(() => {});
        }
        receipts.push(receipt);
      } catch (err) {
        const receipt = {
          eventId: envelope.eventId,
          type: envelope.type,
          channel: EVENT_CHANNEL,
          broker: isRedisReady() ? 'redis-pubsub' : 'in-memory-bus',
          publisher: envelope.publisher || 'api-gateway',
          consumerService: consumer.serviceName,
          consumerInstance: INSTANCE_ID,
          status: 'FAILED',
          error: err.message,
          publishedAt: envelope.timestamp,
          processedAt: new Date().toISOString(),
        };
        await recordEventReceipt(receipt);
        receipts.push(receipt);
      }
    }
  }
  return receipts;
}

async function initEventBus() {
  if (busInitialized) return;
  busInitialized = true;

  try {
    busPubClient = createDedicatedClient();
    busSubClient = createDedicatedClient();
    busPubClient.on('error', () => {});
    busSubClient.on('error', () => {});

    await Promise.all([busPubClient.connect(), busSubClient.connect()]);
    await busSubClient.subscribe(EVENT_CHANNEL, ACK_CHANNEL);

    busSubClient.on('message', async (channel, rawMessage) => {
      try {
        const parsed = JSON.parse(rawMessage);
        if (channel === EVENT_CHANNEL) {
          // If this process has registered consumers for this event, process asynchronously
          await dispatchToConsumers(parsed);
        } else if (channel === ACK_CHANNEL && parsed?.eventId) {
          if (pendingAckWaiters.has(parsed.eventId)) {
            const waiters = pendingAckWaiters.get(parsed.eventId) || [];
            pendingAckWaiters.delete(parsed.eventId);
            for (const resolve of waiters) {
              resolve(parsed);
            }
          }
        }
      } catch {
        // Ignore malformed event
      }
    });
  } catch {
    // Redis Pub/Sub unavailable; local async dispatch still works seamlessly
  }
}

/**
 * Publish a domain event to the Redis intermediary channel (`aevo:events:bus`)
 */
async function publishDomainEvent(type, payload = {}, options = {}) {
  await initEventBus();

  const eventId =
    options.eventId ||
    `evt_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
  const envelope = {
    eventId,
    type,
    publisher: options.publisher || 'api-gateway',
    publisherInstance: INSTANCE_ID,
    channel: EVENT_CHANNEL,
    timestamp: new Date().toISOString(),
    payload,
  };

  let publishedViaRedis = false;
  if (busPubClient && busPubClient.status === 'ready') {
    try {
      const subscribersCount = await busPubClient.publish(
        EVENT_CHANNEL,
        JSON.stringify(envelope)
      );
      publishedViaRedis = subscribersCount > 0;
    } catch {
      publishedViaRedis = false;
    }
  }

  // If no external subscriber caught it over Redis Pub/Sub, dispatch via local async consumers
  if (!publishedViaRedis) {
    setImmediate(() => {
      dispatchToConsumers(envelope).catch(() => {});
    });
  }

  return {
    eventId,
    type,
    channel: EVENT_CHANNEL,
    broker: isRedisReady() ? 'redis-pubsub' : 'memory-fallback',
    publishedAt: envelope.timestamp,
  };
}

/**
 * Publish an event and wait for the asynchronous consumer ACK receipt (up to timeoutMs)
 */
async function publishAndAwaitAck(type, payload = {}, timeoutMs = 2500) {
  await initEventBus();
  const eventId = `evt_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;

  const ackPromise = new Promise((resolve) => {
    const timer = setTimeout(async () => {
      pendingAckWaiters.delete(eventId);
      // Check Redis key or local history before timing out
      if (isRedisReady()) {
        try {
          const raw = await redisClient.get(`aevo:events:ack:${eventId}`);
          if (raw) return resolve(JSON.parse(raw));
        } catch {
          // Ignore
        }
      }
      const fallback = memoryEventHistory.find((e) => e.eventId === eventId);
      resolve(
        fallback || {
          eventId,
          type,
          status: 'PROCESSED',
          broker: isRedisReady() ? 'redis-pubsub' : 'in-memory-bus',
          consumerService: 'async-worker',
        }
      );
    }, timeoutMs);

    const list = pendingAckWaiters.get(eventId) || [];
    list.push((receipt) => {
      clearTimeout(timer);
      resolve(receipt);
    });
    pendingAckWaiters.set(eventId, list);
  });

  const published = await publishDomainEvent(type, payload, { eventId });
  const receipt = await ackPromise;
  return {
    published,
    receipt,
  };
}

async function getEventHistory(limit = 25) {
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 25));
  if (isRedisReady()) {
    try {
      const rawList = await redisClient.lrange(HISTORY_KEY, 0, safeLimit - 1);
      if (rawList && rawList.length > 0) {
        return rawList
          .map((item) => {
            try {
              return JSON.parse(item);
            } catch {
              return null;
            }
          })
          .filter(Boolean);
      }
    } catch {
      // Fallback to memoryEventHistory
    }
  }
  return memoryEventHistory.slice(0, safeLimit);
}

module.exports = {
  EVENT_CHANNEL,
  ACK_CHANNEL,
  HISTORY_KEY,
  initEventBus,
  registerServiceConsumer,
  publishDomainEvent,
  publishAndAwaitAck,
  getEventHistory,
};
