const jwt = require('jsonwebtoken');
const prisma = require('../utils/prisma');

/**
 * Two separate signing keys on purpose.
 *
 * The session token authenticates a request. The reset token authorises a
 * password change. Previously both were signed with the same secret, so a
 * password-reset token was accepted as a session token - anyone who
 * intercepted one could impersonate the account.
 */
const JWT_SECRET = process.env.JWT_SECRET;
const RESET_TOKEN_SECRET = process.env.RESET_TOKEN_SECRET || `${JWT_SECRET}:reset`;

if (!JWT_SECRET) {
  // Fail fast at boot rather than silently signing tokens with a known literal.
  throw new Error(
    'JWT_SECRET is not set. Add it to apps/api/.env (see .env.example).'
  );
}

const SESSION_TTL = '7d';

function readToken(req) {
  return req.cookies?.token || req.headers.authorization?.split(' ')[1];
}

/**
 * Resolve the token owner against the database.
 *
 * The JWT is only a claim; role and isActive are re-read so that a banned
 * user, or a user who was demoted, loses access immediately instead of
 * keeping admin powers until the token expires.
 */
async function resolveUser(req) {
  const token = readToken(req);
  if (!token) return null;

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }

  // A reset token must never authenticate a session.
  if (decoded.purpose) return null;

  const user = await prisma.user.findUnique({
    where: { id: decoded.id },
    select: { id: true, email: true, fullName: true, role: true, isActive: true },
  });

  if (!user || !user.isActive) return null;

  req.user = user;
  return user;
}

// Both are async, so a failing database lookup would otherwise surface as an
// unhandled rejection (Express 4 ignores rejected async middleware). Forward
// the error to the error handler instead: the request answers 500 and the
// process keeps running.
const authMiddleware = async (req, res, next) => {
  try {
    const user = await resolveUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    next();
  } catch (error) {
    next(error);
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    await resolveUser(req);
    next();
  } catch (error) {
    next(error);
  }
};

const adminOnly = (req, res, next) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

const signSessionToken = (user) =>
  jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: SESSION_TTL }
  );

const signResetToken = (user) =>
  jwt.sign({ id: user.id, purpose: 'password_reset' }, RESET_TOKEN_SECRET, {
    expiresIn: '1h',
  });

module.exports = {
  authMiddleware,
  optionalAuth,
  adminOnly,
  signSessionToken,
  signResetToken,
  JWT_SECRET,
  RESET_TOKEN_SECRET,
  SESSION_TTL,
};
