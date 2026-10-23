const passport = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const { Strategy: FacebookStrategy } = require('passport-facebook');
const prisma = require('../utils/prisma');
const { JWT_SECRET } = require('../middleware/auth');

/**
 * Social login (Task 1.5).
 *
 * Both providers are only registered when their credentials are present, so a
 * fresh clone (or a CI run) boots without OAuth env vars instead of crashing.
 * When a provider is unconfigured its route replies 503 with a clear message
 * rather than 500.
 */

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID;
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET;

const API_URL = process.env.API_URL || `http://localhost:${process.env.PORT || 3001}`;
const CLIENT_URL = (process.env.CLIENT_URL || 'http://localhost:3000').split(',')[0].trim();

const isGoogleConfigured = Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
const isFacebookConfigured = Boolean(FACEBOOK_APP_ID && FACEBOOK_APP_SECRET);

/**
 * Resolve an OAuth profile to a local user.
 *
 * 1. An OAuthAccount row for (provider, providerId) wins - that is the
 *    returning social user.
 * 2. Otherwise, if an account with the same email already exists, we link the
 *    OAuth account to it. This is the "link OAuth account with existing user"
 *    requirement, and it is what makes social login work for a user who first
 *    registered with a password.
 * 3. Otherwise create a new CUSTOMER with a null password.
 */
async function upsertOAuthUser({ provider, providerId, email, fullName }) {
  const normalizedEmail = email ? email.trim().toLowerCase() : null;

  const existingLink = await prisma.oAuthAccount.findUnique({
    where: { provider_providerId: { provider, providerId } },
    include: { user: true },
  });

  if (existingLink) {
    return existingLink.user;
  }

  let user = normalizedEmail
    ? await prisma.user.findUnique({ where: { email: normalizedEmail } })
    : null;

  if (user) {
    // Link the social account to the pre-existing local account.
    await prisma.oAuthAccount.create({
      data: { provider, providerId, userId: user.id },
    });
    return user;
  }

  user = await prisma.user.create({
    data: {
      email: normalizedEmail || `${provider}_${providerId}@aevo.local`,
      password: null, // Social users have no password
      fullName: fullName || 'AEVO Customer',
      role: 'CUSTOMER',
      oauthAccounts: {
        create: { provider, providerId },
      },
    },
  });

  return user;
}

if (isGoogleConfigured) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: `${API_URL}/api/auth/google/callback`,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email =
            (profile.emails && profile.emails[0] && profile.emails[0].value) || null;
          const user = await upsertOAuthUser({
            provider: 'google',
            providerId: profile.id,
            email,
            fullName: profile.displayName,
          });
          done(null, user);
        } catch (err) {
          done(err);
        }
      }
    )
  );
}

if (isFacebookConfigured) {
  passport.use(
    new FacebookStrategy(
      {
        clientID: FACEBOOK_APP_ID,
        clientSecret: FACEBOOK_APP_SECRET,
        callbackURL: `${API_URL}/api/auth/facebook/callback`,
        profileFields: ['id', 'displayName', 'emails[0].value'],
        enableProof: false,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email =
            (profile.emails && profile.emails[0] && profile.emails[0].value) || null;
          const user = await upsertOAuthUser({
            provider: 'facebook',
            providerId: profile.id,
            email,
            fullName: profile.displayName,
          });
          done(null, user);
        } catch (err) {
          done(err);
        }
      }
    )
  );
}

module.exports = {
  passport,
  upsertOAuthUser,
  isGoogleConfigured,
  isFacebookConfigured,
  API_URL,
  CLIENT_URL,
  JWT_SECRET,
};
