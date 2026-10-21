// Single shared PrismaClient instance.
//
// Every module used to create its own client, which meant one connection pool
// per module (and a second one inside middleware/auth.js). In development
// nodemon restarts the process often, and each new client leaks a pool until
// the process exits. A single instance also keeps transactions able to reach
// the same client as the rest of the app.
const { PrismaClient } = require('@prisma/client');

const globalForPrisma = globalThis;

const prisma = globalForPrisma.__aevoPrisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__aevoPrisma = prisma;
}

module.exports = prisma;
