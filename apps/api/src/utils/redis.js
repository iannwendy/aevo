const Redis = require('ioredis');
const crypto = require('crypto');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const INSTANCE_ID =
  process.env.INSTANCE_ID ||
  process.env.HOSTNAME ||
  `api-${crypto.randomBytes(4).toString('hex')}`;

const memoryStore = new Map();

function createRedisClient(role = 'main') {
  const client = new Redis(REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: 2000,
    retryStrategy(times) {
      if (times > 3) {
        return null; // Stop retrying aggressively when Redis is absent; fallback is active
      }
      return Math.min(times * 250, 1000);
    },
  });

  client.on('error', () => {
    // Handled gracefully via fallback store; suppress noisy unhandled error events
  });

  client.on('connect', () => {
    if (role === 'main') {
      console.log(`[redis] connected (${REDIS_URL}) on instance ${INSTANCE_ID}`);
    }
  });

  return client;
}

const redisClient = createRedisClient('main');
let pubClient = null;
let subClient = null;

// Attempt initial non-blocking connection
redisClient.connect().catch(() => {});

function isRedisReady(client = redisClient) {
  return Boolean(client && client.status === 'ready');
}

function getRedisStatus() {
  const connected = isRedisReady();
  return {
    connected,
    status: connected ? 'connected' : 'fallback',
    store: connected ? 'redis' : 'memory-fallback',
    url: REDIS_URL.replace(/:\/\/.*@/, '://***@'),
  };
}

/**
 * Store session / cart state in Redis (with automatic TTL and in-memory fallback)
 * so any horizontally scaled API instance can read session state without sticky sessions.
 */
async function setSessionState(key, value, ttlSeconds = 7 * 24 * 3600) {
  const fullKey = `aevo:session:${key}`;
  const serialized = JSON.stringify(value);

  if (isRedisReady()) {
    try {
      await redisClient.set(fullKey, serialized, 'EX', ttlSeconds);
      return true;
    } catch {
      // Fall through to memory fallback
    }
  }

  memoryStore.set(fullKey, {
    value: serialized,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
  return false;
}

async function getSessionState(key) {
  const fullKey = `aevo:session:${key}`;

  if (isRedisReady()) {
    try {
      const raw = await redisClient.get(fullKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      // Fall through to memory fallback
    }
  }

  const entry = memoryStore.get(fullKey);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memoryStore.delete(fullKey);
    return null;
  }
  try {
    return JSON.parse(entry.value);
  } catch {
    return null;
  }
}

async function deleteSessionState(key) {
  const fullKey = `aevo:session:${key}`;
  memoryStore.delete(fullKey);
  if (isRedisReady()) {
    try {
      await redisClient.del(fullKey);
    } catch {
      // Ignore
    }
  }
}

/**
 * Publish a Socket.IO event across all API instances via Redis Pub/Sub.
 */
async function publishSocketEvent(event, room, payload) {
  if (!isRedisReady()) return false;
  try {
    if (!pubClient) {
      pubClient = createRedisClient('pub');
      await pubClient.connect().catch(() => {});
    }
    if (!isRedisReady(pubClient)) return false;

    const message = JSON.stringify({
      instanceId: INSTANCE_ID,
      event,
      room,
      payload,
      timestamp: Date.now(),
    });
    await pubClient.publish('aevo:socket:events', message);
    return true;
  } catch {
    return false;
  }
}

/**
 * Subscribe to cross-instance Socket.IO events from Redis Pub/Sub and forward
 * them to local Socket.IO room subscribers on other instances.
 */
async function initSocketRedisBridge(io) {
  try {
    subClient = createRedisClient('sub');
    await subClient.connect();
    await subClient.subscribe('aevo:socket:events');

    subClient.on('message', (channel, rawMessage) => {
      if (channel !== 'aevo:socket:events') return;
      try {
        const msg = JSON.parse(rawMessage);
        // Only rebroadcast events originating from OTHER instances
        if (!msg || msg.instanceId === INSTANCE_ID) return;
        if (msg.room && msg.event) {
          io.to(msg.room).emit(msg.event, msg.payload);
        }
      } catch {
        // Ignore malformed pub/sub message
      }
    });
  } catch {
    // Redis unavailable; single-instance Socket.IO continues working normally
  }
}

module.exports = {
  INSTANCE_ID,
  redisClient,
  isRedisReady,
  getRedisStatus,
  setSessionState,
  getSessionState,
  deleteSessionState,
  publishSocketEvent,
  initSocketRedisBridge,
};
