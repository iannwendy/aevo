const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // Prisma errors
  if (err.code === 'P2002') {
    return res.status(400).json({
      error: 'A record with this value already exists'
    });
  }

  if (err.code === 'P2025') {
    return res.status(404).json({
      error: 'Record not found'
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Invalid token'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Token expired'
    });
  }

  // Body parser errors (SyntaxError from express.json / express.urlencoded,
  // "request entity too large", unsupported charset...). The message can echo
  // part of the raw request body, so only the generic text is returned.
  if (isBodyParserError(err)) {
    return res.status(err.status >= 400 && err.status < 500 ? err.status : 400).json({
      error: 'Invalid request body'
    });
  }

  const statusCode = resolveStatusCode(err);
  // 5xx responses never echo the internal message: it can name failed
  // upstream calls, database details or OAuth internals.
  const message =
    statusCode >= 500
      ? 'Internal server error'
      : err.message || 'Request failed';

  res.status(statusCode).json({
    error: message,
    // Stack traces are a development aid only.
    ...(process.env.NODE_ENV !== 'production' && statusCode >= 500 && { stack: err.stack })
  });
};

function isBodyParserError(err) {
  return (
    err.type === 'entity.parse.failed' ||
    err.type === 'entity.too.large' ||
    err.type === 'encoding.unsupported' ||
    err.type === 'request.aborted' ||
    (err instanceof SyntaxError && err.status >= 400 && err.status < 500 && 'body' in err)
  );
}

// OAuth library errors carry `status` (RFC 6749 section 5.2): passport-oauth2
// TokenError and AuthorizationError set it, e.g. 400 "invalid_grant" for an
// expired or already-used code, 401 "invalid_client". Without this the handler
// would answer a client mistake with a 500.
function resolveStatusCode(err) {
  const candidate = err.statusCode || err.status;
  if (Number.isInteger(candidate) && candidate >= 400 && candidate <= 599) {
    return candidate;
  }

  return 500;
}

module.exports = { errorHandler };
