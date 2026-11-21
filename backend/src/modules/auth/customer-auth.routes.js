import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { requireAuth, requireCustomer } from '../../middleware/auth.js';
import { makeLimiter } from '../../middleware/rateLimit.js';
import { customerSignupSchema, customerLoginSchema, refreshSchema } from './auth.schemas.js';
import { noStore, clientMeta } from './auth.http.js';

const FIFTEEN_MIN = 15 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;

// Customer (mobile app) endpoints, mounted at /api/customer/auth.
export function createCustomerAuthRouter({
  service,
  signupRateLimit,
  loginRateLimit,
  refreshRateLimit,
}) {
  const router = Router();

  const signupLimiter = makeLimiter({ windowMs: ONE_HOUR, limit: 10, ...signupRateLimit });
  const loginLimiter = makeLimiter({
    windowMs: FIFTEEN_MIN,
    limit: 10,
    skipSuccessfulRequests: true,
    ...loginRateLimit,
  });
  const refreshLimiter = makeLimiter({ windowMs: FIFTEEN_MIN, limit: 60, ...refreshRateLimit });

  router.use(noStore);

  router.post('/signup', signupLimiter, validate(customerSignupSchema), async (req, res) => {
    res.status(201).json(await service.customerSignup({ ...req.body, ...clientMeta(req) }));
  });

  router.post('/login', loginLimiter, validate(customerLoginSchema), async (req, res) => {
    res.json(await service.customerLogin({ ...req.body, ...clientMeta(req) }));
  });

  router.post('/refresh', refreshLimiter, validate(refreshSchema), async (req, res) => {
    res.json(await service.refresh({ ...req.body, ...clientMeta(req) }));
  });

  router.post('/logout', validate(refreshSchema), async (req, res) => {
    await service.logout(req.body);
    res.status(204).end();
  });

  router.get('/me', requireAuth, requireCustomer, async (req, res) => {
    res.json(await service.customerMe(req.auth.userId));
  });

  return router;
}
