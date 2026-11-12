import { randomUUID } from 'node:crypto';
import { AppError, NotFoundError } from '../utils/errors.js';

// Unknown /api routes.
export function notFound(req, res, next) {
  next(new NotFoundError(`Route ${req.method} ${req.originalUrl} not found`));
}

// Every error leaves the API in the same JSON format (SDD 5.1 and 6.5).
export function errorHandler(err, req, res, _next) {
  const requestId = randomUUID().slice(0, 8);

  if (err instanceof AppError) {
    return res
      .status(err.status)
      .json({ error: { code: err.code, message: err.message, requestId } });
  }

  // Client errors raised by Express itself, such as a malformed JSON body.
  if (err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({
      error: { code: 'BAD_REQUEST', message: 'Invalid request', requestId },
    });
  }

  // Unexpected errors: full details in the logs, none in the response.
  console.error(`[${requestId}]`, err);
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      requestId,
    },
  });
}
