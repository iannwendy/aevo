const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const prisma = require('../../utils/prisma');
const {
  authMiddleware,
  optionalAuth,
  signSessionToken,
  signResetToken,
  RESET_TOKEN_SECRET,
} = require('../../middleware/auth');
const { rateLimit } = require('../../middleware/rateLimit');
const { setSessionState, deleteSessionState } = require('../../utils/redis');
const { asyncHandler } = require('../../middleware/asyncHandler');
const { sendPasswordResetEmail, sendWelcomeAccountEmail } = require('../../services/mailer');
const crypto = require('crypto');

function generateTemporaryPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 6; i++) {
    suffix += chars[crypto.randomInt(0, chars.length)];
  }
  return `Aevo${suffix}`;
}
const {
  passport,
  isGoogleConfigured,
  isFacebookConfigured,
  CLIENT_URL,
} = require('../../config/passport');
const jwt = require('jsonwebtoken');

const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

/**
 * bcrypt only reads the first 72 bytes of a password. Without an upper bound
 * two different long passwords can hash to the same value and either one logs
 * in, so the limit is enforced at the validator.
 */
const PASSWORD_MAX = 72;

function setAuthCookie(res, token) {
  const isSecure = Boolean(res.req?.secure || res.req?.headers?.['x-forwarded-proto'] === 'https');
  res.cookie('token', token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  });
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    loyaltyPoints: user.loyaltyPoints,
  };
}

// ---------------------------------------------------------------- Register
router.post(
  '/register',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 200, message: 'Too many registration attempts' }),
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: 'Too many registration attempts for this email',
    keyGenerator: (req) => String(req.body?.email || '').toLowerCase(),
  }),
  [
    body('email').isString().isEmail().normalizeEmail(),
    body('password').optional({ checkFalsy: true }).isString().isLength({ min: 6, max: PASSWORD_MAX }),
    body('fullName').isString().trim().isLength({ min: 1, max: 120 }),
    body('address').optional().isString().trim(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, fullName, address, phone, ward, district, city } = req.body;

    try {
      // Rely on the unique index rather than a check-then-create race: two
      // concurrent registrations for the same email must not produce a 500.
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        return res.status(400).json({ error: 'Email already registered' });
      }

      const generatedPassword = !password ? generateTemporaryPassword() : null;
      const passwordToHash = password || generatedPassword;
      const hashedPassword = await bcrypt.hash(passwordToHash, 10);
      const cleanAddress = typeof address === 'string' && address.trim() ? address.trim().slice(0, 300) : null;
      const cleanPhone = typeof phone === 'string' ? phone.trim().slice(0, 30) : '';
      const cleanWard = typeof ward === 'string' && ward.trim() ? ward.trim().slice(0, 120) : null;
      const cleanDistrict = typeof district === 'string' && district.trim() ? district.trim().slice(0, 120) : null;
      const cleanCity = typeof city === 'string' && city.trim() ? city.trim().slice(0, 120) : 'Ho Chi Minh City';

      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          fullName,
          role: 'CUSTOMER',
          loyaltyPoints: 0,
          isActive: true,
          addresses: cleanAddress
            ? {
                create: {
                  fullName,
                  phone: cleanPhone,
                  address: cleanAddress,
                  ward: cleanWard,
                  district: cleanDistrict,
                  city: cleanCity,
                  isDefault: true,
                },
              }
            : undefined,
        },
        include: { addresses: true },
      });

      const resetJwt = signResetToken(user);
      const resetTokenHash = crypto.createHash('sha256').update(resetJwt).digest('hex');
      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          token: resetTokenHash,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
      const resetUrl = `${CLIENT_URL}/reset-password?token=${encodeURIComponent(resetJwt)}`;

      if (generatedPassword) {
        sendWelcomeAccountEmail({
          to: user.email,
          fullName: user.fullName,
          temporaryPassword: generatedPassword,
          resetUrl,
        }).catch(() => {});
      }

      const token = signSessionToken(user);
      setAuthCookie(res, token);

      return res.status(201).json({
        user: { ...publicUser(user), addresses: user.addresses },
        token,
        ...(generatedPassword && { generatedPassword, resetUrl }),
      });
    } catch (error) {
      if (error.code === 'P2002') {
        return res.status(400).json({ error: 'Email already registered' });
      }
      console.error('Register error:', error);
      return res.status(500).json({ error: 'Registration failed' });
    }
  }
);

// ------------------------------------------------------------------- Login
router.post(
  '/login',
  // Per-IP limit plus a per-account limit, so one attacker cannot lock a
  // victim out by burning their budget from a single address, and one address
  // cannot spread guesses across many accounts within the IP budget.
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    message: 'Too many login attempts',
    skipSuccessfulRequests: true,
  }),
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: 'Too many login attempts for this account',
    keyGenerator: (req) => String(req.body?.email || '').toLowerCase(),
    skipSuccessfulRequests: true,
  }),
  [
    body('email').isString().isEmail().normalizeEmail(),
    body('password').isString().notEmpty(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    try {
      const user = await prisma.user.findUnique({
        where: { email },
        include: { addresses: true, oauthAccounts: true },
      });

      // One generic message for both unknown email and wrong password so the
      // endpoint cannot be used to enumerate registered accounts.
      if (!user) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      // A social-only account has no password to compare against, so say how
      // to sign in instead of pretending the password was wrong.
      if (!user.password) {
        if (user.oauthAccounts && user.oauthAccounts.length > 0) {
          return res.status(401).json({ error: 'Please use social login' });
        }
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      if (!user.isActive) {
        return res.status(403).json({ error: 'Account has been banned' });
      }

      const token = signSessionToken(user);
      setAuthCookie(res, token);
      setSessionState(`auth:${user.id}`, {
        userId: user.id,
        role: user.role,
        active: true,
        updatedAt: new Date().toISOString(),
      }).catch(() => {});

      return res.json({
        user: { ...publicUser(user), addresses: user.addresses },
        token,
      });
    } catch (error) {
      console.error('Login error:', error);
      return res.status(500).json({ error: 'Login failed' });
    }
  }
);

// ------------------------------------------------------------------ Logout
// The cookie was set with httpOnly/secure/sameSite and no domain; clearCookie
// only expires a cookie whose attributes match, so mirror them here.
router.post('/logout', optionalAuth, (req, res) => {
  if (req.user?.id) {
    deleteSessionState(`auth:${req.user.id}`).catch(() => {});
  }
  const isSecure = Boolean(req.secure || req.headers?.['x-forwarded-proto'] === 'https');
  res.clearCookie('token', {
    path: '/',
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
  });
  res.json({ message: 'Logged out successfully' });
});

// ----------------------------------------------------------------- Profile
router.get(
  '/profile',
  (req, res, next) => {
    if (req.query.optional === '1') {
      return optionalAuth(req, res, next);
    }
    return authMiddleware(req, res, next);
  },
  asyncHandler(async (req, res) => {
    if (!req.user) {
      return res.json({ authenticated: false, user: null });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { addresses: true, oauthAccounts: true },
    });

    if (!user) {
      if (req.query.optional === '1') {
        return res.json({ authenticated: false, user: null });
      }
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      loyaltyPoints: user.loyaltyPoints,
      addresses: user.addresses,
      oauthAccounts: user.oauthAccounts,
    });
  })
);

router.put(
  '/profile',
  authMiddleware,
  [body('fullName').trim().notEmpty()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { fullName, phone, address, city } = req.body;

    try {
      await prisma.user.update({
        where: { id: req.user.id },
        data: { fullName },
      });

      const cleanPhone = typeof phone === 'string' ? phone.trim() : undefined;
      const cleanAddress = typeof address === 'string' && address.trim() ? address.trim() : undefined;
      const cleanCity = typeof city === 'string' && city.trim() ? city.trim() : undefined;

      if (cleanPhone !== undefined || cleanAddress !== undefined) {
        const defaultAddr = await prisma.address.findFirst({
          where: { userId: req.user.id, isDefault: true },
        });
        const fallbackAddr =
          defaultAddr ||
          (await prisma.address.findFirst({
            where: { userId: req.user.id },
            orderBy: { createdAt: 'desc' },
          }));

        if (fallbackAddr) {
          await prisma.address.update({
            where: { id: fallbackAddr.id },
            data: {
              fullName,
              ...(cleanPhone !== undefined && { phone: cleanPhone }),
              ...(cleanAddress !== undefined && { address: cleanAddress }),
              ...(cleanCity !== undefined && { city: cleanCity }),
              isDefault: true,
            },
          });
        } else if (cleanPhone || cleanAddress) {
          await prisma.address.create({
            data: {
              userId: req.user.id,
              fullName,
              phone: cleanPhone || '',
              address: cleanAddress || 'Ho Chi Minh City',
              city: cleanCity || 'Ho Chi Minh City',
              isDefault: true,
            },
          });
        }
      }

      const updatedUser = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: { addresses: true },
      });

      return res.json({
        ...publicUser(updatedUser),
        addresses: updatedUser.addresses,
      });
    } catch (error) {
      console.error('Update profile error:', error);
      return res.status(500).json({ error: 'Update failed' });
    }
  }
);

// ---------------------------------------------------------- Change password
router.put(
  '/password',
  authMiddleware,
  [
    body('currentPassword').notEmpty(),
    body('newPassword').isLength({ min: 6, max: PASSWORD_MAX }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { currentPassword, newPassword } = req.body;

    try {
      const user = await prisma.user.findUnique({ where: { id: req.user.id } });

      if (!user.password) {
        return res
          .status(400)
          .json({ error: 'Cannot change password for social login accounts' });
      }

      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({ error: 'Current password is incorrect' });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await prisma.user.update({
        where: { id: req.user.id },
        data: { password: hashedPassword },
      });

      // Changing the password invalidates any outstanding reset links.
      await prisma.passwordResetToken.updateMany({
        where: { userId: req.user.id, usedAt: null },
        data: { usedAt: new Date() },
      });

      return res.json({ message: 'Password changed successfully' });
    } catch (error) {
      console.error('Change password error:', error);
      return res.status(500).json({ error: 'Password change failed' });
    }
  }
);

// ----------------------------------------------------------- Forgot password
router.post(
  '/forgot-password',
  // Both per-IP and per-address: the per-address bucket stops a single
  // mailbox from being spammed with reset emails from many addresses.
  rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: 'Too many reset requests' }),
  rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: 'Too many reset requests for this address',
    keyGenerator: (req) => String(req.body?.email || '').toLowerCase(),
  }),
  [body('email').isString().isEmail().normalizeEmail()],
  async (req, res) => {
    const errors = validationResult(req);
    const generic = { message: 'If email exists, reset link will be sent' };
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email } = req.body;

    try {
      const user = await prisma.user.findUnique({ where: { email } });

      // The response is identical whether or not the address exists, so the
      // endpoint cannot be used to discover registered accounts.
      if (!user || !user.isActive) return res.json(generic);

      const token = signResetToken(user);

      // Store a hash of the token server-side so it can be revoked after use.
      const tokenHash = require('crypto')
        .createHash('sha256')
        .update(token)
        .digest('hex');

      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          token: tokenHash,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });

      const link = `${CLIENT_URL}/reset-password?token=${encodeURIComponent(token)}`;
      await sendPasswordResetEmail(user.email, user.fullName, link);

      // The token is never echoed in the response body. Previously it was,
      // which handed anyone who called the endpoint a working reset link.
      return res.json(generic);
    } catch (error) {
      console.error('Forgot password error:', error);
      return res.status(500).json({ error: 'Request failed' });
    }
  }
);

// ----------------------------------------------------------- Reset password
router.post(
  '/reset-password',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: 'Too many reset attempts' }),
  [
    body('token').isString().notEmpty(),
    body('newPassword').isString().isLength({ min: 6, max: PASSWORD_MAX }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { token, newPassword } = req.body;

    try {
      const decoded = jwt.verify(token, RESET_TOKEN_SECRET, { algorithms: ['HS256'] });
      if (!decoded || decoded.purpose !== 'password_reset' || typeof decoded.id !== 'string') {
        return res.status(400).json({ error: 'Invalid token' });
      }

      const tokenHash = require('crypto')
        .createHash('sha256')
        .update(token)
        .digest('hex');

      const record = await prisma.passwordResetToken.findUnique({
        where: { token: tokenHash },
      });

      // A reset link is single-use: the server record must exist, be unused
      // and not have expired.
      if (!record || record.usedAt || record.expiresAt < new Date()) {
        return res.status(400).json({ error: 'Invalid or expired token' });
      }

      if (record.userId !== decoded.id) {
        return res.status(400).json({ error: 'Invalid or expired token' });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await prisma.user.update({
        where: { id: decoded.id },
        data: { password: hashedPassword },
      });

      await prisma.passwordResetToken.updateMany({
        where: { userId: decoded.id, usedAt: null },
        data: { usedAt: new Date() },
      });

      return res.json({ message: 'Password reset successfully' });
    } catch (error) {
      if (error.name === 'TokenExpiredError' || error.name === 'JsonWebTokenError') {
        return res.status(400).json({ error: 'Invalid or expired token' });
      }
      console.error('Reset password error:', error);
      return res.status(400).json({ error: 'Invalid or expired token' });
    }
  }
);

// ------------------------------------------------------------ Social login
router.get('/google', (req, res) => {
  if (!isGoogleConfigured) {
    return res.status(503).json({
      error: 'Google login is not configured on this server',
    });
  }
  return passport.authenticate('google', { scope: ['email', 'profile'] })(req, res);
});

router.get('/google/callback', (req, res, next) => {
  if (!isGoogleConfigured) {
    return res.status(503).json({ error: 'Google login is not configured on this server' });
  }
  return passport.authenticate('google', { session: false }, (err, user) => {
    // Passport funnels every expected failure here instead of raising:
    //   - no user: consent denied, or the state nonce did not match;
    //   - err: bad/expired/reused code (TokenError 400), provider refusing
    //     the client (401), provider 5xx, or a network failure (TokenError
    //     with `status` 500, still an upstream/input problem, never ours).
    // Either way the user belongs back on the login page with a copy that the
    // frontend understands, not on a JSON error page.
    if (err || !user) {
      console.warn(
        'Google OAuth callback failed:',
        err ? `${err.name || 'Error'}: ${err.message}` : 'no user (consent denied or state mismatch)'
      );
      return res.redirect(`${CLIENT_URL}/login?error=oauth_failed`);
    }
    if (!user.isActive) {
      return res.redirect(`${CLIENT_URL}/login?error=account_banned`);
    }
    const token = signSessionToken(user);
    setAuthCookie(res, token);
    return res.redirect(`${CLIENT_URL}/account/profile?login=success`);
  })(req, res, next);
});

router.get('/facebook', (req, res) => {
  if (!isFacebookConfigured) {
    return res.status(503).json({
      error: 'Facebook login is not configured on this server',
    });
  }
  return passport.authenticate('facebook', { scope: ['email'] })(req, res);
});

router.get('/facebook/callback', (req, res, next) => {
  if (!isFacebookConfigured) {
    return res.status(503).json({ error: 'Facebook login is not configured on this server' });
  }
  return passport.authenticate('facebook', { session: false }, (err, user) => {
    // Same contract as the Google callback: every failure lands on the login
    // page. Facebook reports refusals as error_code/error_message, which
    // passport-facebook turns into a FacebookAuthorizationError.
    if (err || !user) {
      console.warn(
        'Facebook OAuth callback failed:',
        err ? `${err.name || 'Error'}: ${err.message}` : 'no user (consent denied or state mismatch)'
      );
      return res.redirect(`${CLIENT_URL}/login?error=oauth_failed`);
    }
    if (!user.isActive) {
      return res.redirect(`${CLIENT_URL}/login?error=account_banned`);
    }
    const token = signSessionToken(user);
    setAuthCookie(res, token);
    return res.redirect(`${CLIENT_URL}/account/profile?login=success`);
  })(req, res, next);
});

module.exports = router;
