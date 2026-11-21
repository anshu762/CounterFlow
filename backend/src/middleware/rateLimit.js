import rateLimit from 'express-rate-limit';
import { AppError } from '../utils/errors.js';

export function makeLimiter(options) {
  return rateLimit({
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, _res, next) =>
      next(new AppError('Too many attempts. Please try again later.', 429, 'RATE_LIMITED')),
    ...options,
  });
}
