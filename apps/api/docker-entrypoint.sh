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
  prisma.product.findUnique({ where: { slug: 'apple-thunderbolt-5-pro-docking-station' } }),
  prisma.product.findUnique({ where: { slug: 'nvidia-geforce-rtx-5090-founders-edition-32gb-gddr7' } }),
])
  .then(([count, flagship, tb5Dock, rtx5090]) => {
    const isUpToDate =
      count >= 187 &&
      Boolean(flagship) &&
      Boolean(tb5Dock) &&
      Boolean(rtx5090) &&
      Number(rtx5090.minPrice) === 62990000;
    console.log(
      '[entrypoint] Existing products in database:',
      count,
      '| Up-to-date catalog (Apple + 20 NVIDIA GPUs):',
      isUpToDate
    );
    process.exit(isUpToDate ? 0 : 42);
  })
  .catch((err) => {
    console.error('[entrypoint] Seed check error:', err.message);
    process.exit(42);
  })
  .finally(() => prisma.\$disconnect());
" || npm run db:seed

echo "[entrypoint] Starting AEVO API server..."
exec npm start
