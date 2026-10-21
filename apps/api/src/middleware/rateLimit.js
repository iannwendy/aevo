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
  for (const [key, hits] of buckets) {
    const live = hits.filter((t) => now - t < hits.windowMs);
    if (live.length === 0) buckets.delete(key);
    else hits.set(key, live);
  }
}, 60_000).unref?.();

/**
 * @param {object} options
 * @param {number} options.windowMs - sliding window length
 * @param {number} options.max - max requests per window per key
 * @param {string} options.message - body returned when the limit is hit
 */
function rateLimit({ windowMs = 15 * 60 * 1000, max = 20, message = 'Too many requests, please try again later' } = {}) {
  return (req, res, next) => {
    const key = `${req.ip}:${req.path}`;
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
    next();
  };
}

module.exports = { rateLimit };
