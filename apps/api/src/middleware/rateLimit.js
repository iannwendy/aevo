/**
 * In-memory sliding-window rate limiter.
 *
 * Protects the auth endpoints from brute-force attempts (a missing control
 * flagged in the security review). It is intentionally dependency-free and
 * per-process: enough for a single-instance deployment, and it swaps for
 * Redis when the app scales horizontally.
 */
const buckets = new Map();

// Drop expired buckets periodically so the map cannot grow without bound.
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of buckets) {
    const live = entry.hits.filter((t) => now - t < entry.windowMs);
    if (live.length === 0) buckets.delete(key);
    else entry.hits.splice(0, entry.hits.length, ...live);
  }
}, 60_000).unref?.();

/**
 * @param {object} options
 * @param {number} options.windowMs - sliding window length
 * @param {number} options.max - max requests per window per key
 * @param {string} options.message - body returned when the limit is hit
 * @param {(req: import('express').Request) => string} [options.keyGenerator]
 *   extra identity appended to the key. By default the key is only IP+path,
 *   so counting per account as well requires passing e.g.
 *   `(req) => String(req.body?.email || '').toLowerCase()`.
 */
function rateLimit({
  windowMs = 15 * 60 * 1000,
  max = 20,
  message = 'Too many requests, please try again later',
  keyGenerator,
  skipSuccessfulRequests = false,
} = {}) {
  return (req, res, next) => {
    const suffix = keyGenerator ? `:${keyGenerator(req)}` : '';
    const key = `${req.ip}:${req.path}${suffix}`;
    const now = Date.now();

    let entry = buckets.get(key);
    if (!entry) {
      entry = { hits: [], windowMs };
      buckets.set(key, entry);
    }

    entry.hits = entry.hits.filter((t) => now - t < windowMs);

    if (entry.hits.length >= max) {
      const retryAfter = Math.ceil((entry.windowMs - (now - entry.hits[0])) / 1000);
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({ error: message, retryAfter });
    }

    entry.hits.push(now);

    if (skipSuccessfulRequests) {
      res.on('finish', () => {
        if (res.statusCode < 400) {
          const idx = entry.hits.indexOf(now);
          if (idx !== -1) entry.hits.splice(idx, 1);
        }
      });
    }

    next();
  };
}

module.exports = { rateLimit };
