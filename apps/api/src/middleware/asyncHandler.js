/**
 * Wrap an async route handler so a rejected promise reaches the error handler.
 *
 * Express 4 only routes errors passed to `next()` to error middleware; an
 * `async` handler that throws (for example a Prisma call outside a try/catch)
 * produces an unhandled rejection that terminates the process. Wrapping the
 * handler turns that into a normal `next(err)` -> errorHandler path, so a
 * single failing query answers 500 instead of taking the API down.
 */
function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

module.exports = { asyncHandler };
