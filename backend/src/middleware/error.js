import { ZodError } from 'zod';
import { AppError } from '../utils/errors.js';
import { logger } from '../config/logger.js';

// Every error response uses this one shape: { error: { code, message, details? } }
export function notFound(req, res) {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.originalUrl} not found` },
  });
}

// error related db if connection fail some reasons

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: err.issues },
    });
  }

  if (err.type === 'entity.parse.failed') {
    return res
      .status(400)
      .json({ error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON' } });
  }

  if (err instanceof AppError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
  }

  const status = err.status && err.status < 500 ? err.status : 500;
  if (status >= 500) {
    logger.error({ err }, 'Unhandled error');
  }
  return res.status(status).json({
    error: {
      code: status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR',
      message: status >= 500 ? 'Something went wrong' : err.message,
    },
  });
}
