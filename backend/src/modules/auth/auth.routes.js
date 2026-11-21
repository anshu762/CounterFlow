import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { requireAuth, requireStaff } from '../../middleware/auth.js';
import { makeLimiter } from '../../middleware/rateLimit.js';
import { loginSchema, refreshSchema } from './auth.schemas.js';
import { changePasswordSchema } from './password.schemas.js';
import { noStore, clientMeta } from './auth.http.js';

const FIFTEEN_MIN = 15 * 60 * 1000;

// Staff (owner / staff) endpoints, mounted at /api/auth.
export function createAuthRouter({ service, loginRateLimit, refreshRateLimit }) {
  const router = Router();

  // Only failed logins count towards the limit (successful ones are skipped).
  const loginLimiter = makeLimiter({
    windowMs: FIFTEEN_MIN,
    limit: 10,
    skipSuccessfulRequests: true,
    ...loginRateLimit,
  });
  const passwordLimiter = makeLimiter({
    windowMs: FIFTEEN_MIN,
    limit: 10,
    skipSuccessfulRequests: true,
    ...loginRateLimit,
  });
  const refreshLimiter = makeLimiter({ windowMs: FIFTEEN_MIN, limit: 60, ...refreshRateLimit });

  router.use(noStore);

  router.post('/login', loginLimiter, validate(loginSchema), async (req, res) => {
    res.json(await service.login({ ...req.body, ...clientMeta(req) }));
  });

  router.post('/refresh', refreshLimiter, validate(refreshSchema), async (req, res) => {
    res.json(await service.refresh({ ...req.body, ...clientMeta(req) }));
  });

  router.post('/logout', validate(refreshSchema), async (req, res) => {
    await service.logout(req.body);
    res.status(204).end();
  });

  router.get('/me', requireAuth, requireStaff, async (req, res) => {
    res.json(await service.me(req.auth.userId));
  });

  router.post(
    '/change-password',
    requireAuth,
    requireStaff,
    passwordLimiter,
    validate(changePasswordSchema),
    async (req, res) => {
      res.json(
        await service.changeAdminPassword({
          userId: req.auth.userId,
          ...req.body,
          ...clientMeta(req),
        }),
      );
    },
  );

  return router;
}
