/**
 * Allowlisted browser origins for CORS (and Socket.IO).
 *
 * CLIENT_URL accepts a comma-separated list so a deployment can serve the web
 * app from more than one origin (e.g. http://localhost:3000 during development
 * and https://app.example.com in production).
 */
const DEFAULT_CLIENT_URL = 'http://localhost:3000';

const ALLOWED_ORIGINS = (process.env.CLIENT_URL || DEFAULT_CLIENT_URL)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

function matches(requestOrigin) {
  // Requests without an Origin header (curl, server-to-server, same-origin
  // navigations) are not subject to CORS.
  if (!requestOrigin) return true;
  return ALLOWED_ORIGINS.includes(requestOrigin);
}

/**
 * Origin callback for the `cors` package.
 *
 * cors accepts either a synchronous predicate `(origin) => boolean` or an
 * asynchronous `(origin, callback)`. Only the async form returns `false` for a
 * rejected origin (the header is omitted); the sync form is merely used as a
 * predicate and "allowed" origins are reflected back. We use the async form so
 * a rejected origin really gets no Access-Control-Allow-Origin.
 */
function isAllowedOrigin(origin, callback) {
  if (typeof callback === 'function') {
    return callback(null, matches(origin));
  }
  return matches(origin);
}

module.exports = { ALLOWED_ORIGINS, isAllowedOrigin };
