require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const { createServer } = require('http');
const { Server } = require('socket.io');

const routes = require('./routes');
const prisma = require('./utils/prisma');
const {
  INSTANCE_ID,
  getRedisStatus,
  initSocketRedisBridge,
} = require('./utils/redis');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { passport } = require('./config/passport');
const { isAllowedOrigin } = require('./config/origins');
const { sanitizeRequest } = require('./utils/security');
const { registerAllDomainConsumers } = require('./microservices/domain-consumers');
const {
  syncAllProductsToElasticsearch,
  checkEsClusterHealth,
} = require('./utils/elasticsearch');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
const httpServer = createServer(app);

// Socket.IO setup for realtime reviews
const io = new Server(httpServer, {
  cors: {
    origin: isAllowedOrigin,
    methods: ['GET', 'POST'],
  },
  maxHttpBufferSize: 64 * 1024, // 64KB max socket payload
});

// Make io available globally and bridge events across instances via Redis Pub/Sub
app.set('io', io);
initSocketRedisBridge(io);

// Attach stateless instance identifier header for horizontal load-balancing visibility
app.use((req, res, next) => {
  res.setHeader('X-Instance-Id', INSTANCE_ID);
  next();
});

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  frameguard: { action: 'deny' },
}));
app.use(cors({
  // Only the allowlisted client origins get an Access-Control-Allow-Origin
  // header; anything else is left without one so browsers block the read.
  origin: isAllowedOrigin,
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb', parameterLimit: 100 }));
app.use(cookieParser());
app.use(sanitizeRequest);

// Passport is mounted for the social login routes. The strategies themselves
// only register when their credentials are present.
app.use(passport.initialize());

// Routes
app.use('/api', routes);

// Health check (stateless architecture, PostgreSQL & Redis readiness)
app.get('/health', async (req, res) => {
  let dbStatus = 'connected';
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbStatus = 'disconnected';
  }
  const redisInfo = getRedisStatus();
  const esInfo = await checkEsClusterHealth();
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    instanceId: INSTANCE_ID,
    stateless: true,
    authMode: 'jwt',
    database: dbStatus,
    redis: redisInfo,
    elasticsearch: esInfo,
  });
});

// Unknown routes: JSON 404 in the same shape as every other error
app.use(notFoundHandler);

// Error handling
app.use(errorHandler);

// Socket.IO connection handling
const SAFE_ROOM_ID = /^[\w-]{1,64}$/;
const MAX_ROOMS_PER_SOCKET = 25;

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join-product', (productId) => {
    if (typeof productId !== 'string' || !SAFE_ROOM_ID.test(productId)) return;
    if (socket.rooms.size >= MAX_ROOMS_PER_SOCKET) return;
    socket.join(`product-${productId}`);
  });

  socket.on('leave-product', (productId) => {
    if (typeof productId !== 'string' || !SAFE_ROOM_ID.test(productId)) return;
    socket.leave(`product-${productId}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// A rejected promise nobody awaited used to terminate the process with no
// usable log (under nodemon that shows up as a bare "app crashed"). Log it and
// keep serving: every route that can fail is expected to handle its own
// errors, so this is a bug report, not a reason to take the API down.
process.on('unhandledRejection', (reason) => {
  console.error('[process] unhandled promise rejection:', reason);
});

// Last line of defence: if the process is going down anyway, make sure the
// stack reaches the log before the exit (nodemon shows "app crashed" without
// this). Exit explicitly so a supervisor restarts a known-clean process.
process.on('uncaughtException', (error) => {
  console.error('[process] uncaught exception, shutting down:', error);
  process.exit(1);
});

const PORT = process.env.PORT || 3001;

httpServer.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(
      `[api] port ${PORT} is already in use. Another server is still running:\n` +
        `      lsof -nP -iTCP:${PORT} -sTCP:LISTEN\n` +
        '      Stop it (or set PORT to a free port) and start again.'
    );
    process.exit(1);
  }

  console.error('[api] failed to start the HTTP server:', error);
  process.exit(1);
});

httpServer.listen(PORT, async () => {
  console.log(`AEVO API server running on port ${PORT} (instance: ${INSTANCE_ID})`);
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('[db] Connected to postgres database successfully');
    await registerAllDomainConsumers('all');
    await syncAllProductsToElasticsearch();
  } catch (err) {
    console.error('[db] Failed to verify postgres connection:', err.message);
  }
});

module.exports = { app, io };
