import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AppError } from '../../utils/errors.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { loginSchema, refreshSchema } from './auth.schemas.js';
import { createAuthService } from './auth.service.js';

const FIFTEEN_MIN = 15 * 60 * 1000;

function makeLimiter(options) {
  return rateLimit({
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, _res, next) =>
      next(new AppError('Too many attempts. Please try again later.', 429, 'RATE_LIMITED')),
    ...options,
  });
}

export function createAuthRouter({ store, loginRateLimit, refreshRateLimit }) {
  const router = Router();
  const service = createAuthService({ store });

  // Only failed logins count towards the limit (successful ones are skipped).
  const loginLimiter = makeLimiter({
    windowMs: FIFTEEN_MIN,
    limit: 10,
    skipSuccessfulRequests: true,
    ...loginRateLimit,
  });
  const refreshLimiter = makeLimiter({ windowMs: FIFTEEN_MIN, limit: 60, ...refreshRateLimit });

  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  const meta = (req) => ({ ip: req.ip, userAgent: req.get('user-agent') });

  router.post('/login', loginLimiter, validate(loginSchema), async (req, res) => {
    res.json(await service.login({ ...req.body, ...meta(req) }));
  });

  router.post('/refresh', refreshLimiter, validate(refreshSchema), async (req, res) => {
    res.json(await service.refresh({ ...req.body, ...meta(req) }));
  });

  router.post('/logout', validate(refreshSchema), async (req, res) => {
    await service.logout(req.body);
    res.status(204).end();
  });

  router.get('/me', requireAuth, async (req, res) => {
    res.json(await service.me(req.auth.userId));
  });

  return router;
}
