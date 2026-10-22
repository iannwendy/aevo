/**
 * Security utilities & sanitization middleware for AEVO API.
 *
 * Defends against:
 * - Prototype pollution (__proto__, constructor, prototype)
 * - Null-byte injection (\0)
 * - HTML / XSS injection in emails and text fields
 * - CRLF header injection in emails
 * - Dangerous URI schemes (javascript:, vbscript:, data:text/html) in media URLs
 */

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function cleanValue(val, depth = 0) {
  if (depth > 10) return undefined;
  if (typeof val === 'string') {
    // Strip null bytes which can truncate C/POSIX strings or bypass filters
    return val.replace(/\0/g, '');
  }
  if (Array.isArray(val)) {
    return val.map((item) => cleanValue(item, depth + 1));
  }
  if (val !== null && typeof val === 'object') {
    const out = {};
    for (const key of Object.keys(val)) {
      if (DANGEROUS_KEYS.has(key)) continue;
      out[key] = cleanValue(val[key], depth + 1);
    }
    return out;
  }
  return val;
}

/**
 * Express middleware that strips prototype-pollution keys and null bytes
 * from req.body, req.query, and req.params.
 */
function sanitizeRequest(req, _res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = cleanValue(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    req.query = cleanValue(req.query);
  }
  if (req.params && typeof req.params === 'object') {
    req.params = cleanValue(req.params);
  }
  next();
}

function escapeHtml(input) {
  if (input === null || input === undefined) return '';
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stripCrLf(input) {
  if (input === null || input === undefined) return '';
  return String(input).replace(/[\r\n]+/g, ' ').trim();
}

/**
 * Validates that an image URL does not use dangerous executable schemes
 * such as javascript:, vbscript:, or data:text/html.
 */
function isSafeImageUrl(url) {
  if (typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed || trimmed.length > 2048) return false;

  // Reject control characters and whitespace-obfuscated schemes
  const normalized = trimmed.replace(/[\s\u0000-\u001F]+/g, '').toLowerCase();
  if (
    normalized.startsWith('javascript:') ||
    normalized.startsWith('vbscript:') ||
    normalized.startsWith('data:text/') ||
    normalized.startsWith('data:application/')
  ) {
    return false;
  }

  // Allow relative paths (/images/...) or http(s) URLs or safe data:image/*
  if (trimmed.startsWith('/')) {
    return !trimmed.startsWith('//');
  }
  if (/^data:image\/(png|jpeg|jpg|webp|gif|avif);base64,/i.test(trimmed)) {
    return true;
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

module.exports = {
  sanitizeRequest,
  escapeHtml,
  stripCrLf,
  isSafeImageUrl,
};
