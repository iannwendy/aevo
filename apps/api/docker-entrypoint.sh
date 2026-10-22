#!/bin/sh
set -e

echo "[entrypoint] Synchronizing Prisma schema with PostgreSQL..."
npx prisma db push --skip-generate

echo "[entrypoint] Verifying initial catalog seed data..."
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.product
  .count()
  .then((count) => {
    console.log('[entrypoint] Existing products in database:', count);
    process.exit(count > 0 ? 0 : 42);
  })
  .catch((err) => {
    console.error('[entrypoint] Seed check error:', err.message);
    process.exit(42);
  })
  .finally(() => prisma.\$disconnect());
" || npm run db:seed

echo "[entrypoint] Starting AEVO API server..."
exec npm start
