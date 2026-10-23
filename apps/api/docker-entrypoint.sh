#!/bin/sh
set -e

if [ -n "$SERVICE_ROLE" ] && [ "$SERVICE_ROLE" != "api-gateway" ]; then
  echo "[entrypoint] Starting AEVO microservice ($SERVICE_ROLE) on port ${PORT:-3002}..."
  exec node src/microservices/service-runner.js
fi

echo "[entrypoint] Synchronizing Prisma schema with PostgreSQL..."
npx prisma db push --skip-generate

echo "[entrypoint] Verifying initial catalog seed data..."
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
Promise.all([
  prisma.product.count(),
  prisma.product.findUnique({ where: { slug: 'macbook-pro-16-m5-max-2026' } }),
])
  .then(([count, flagship]) => {
    console.log('[entrypoint] Existing products in database:', count, '| Apple 2026 seeded:', Boolean(flagship));
    process.exit(count > 0 && flagship ? 0 : 42);
  })
  .catch((err) => {
    console.error('[entrypoint] Seed check error:', err.message);
    process.exit(42);
  })
  .finally(() => prisma.\$disconnect());
" || npm run db:seed

echo "[entrypoint] Starting AEVO API server..."
exec npm start
