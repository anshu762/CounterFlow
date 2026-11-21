import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { requireAuth, requireStaff } from '../../middleware/auth.js';
import { requireCurrentRole } from '../../middleware/freshAuth.js';
import { ROLE_OWNER, ROLE_STAFF } from '../auth/roles.js';
import { noStore } from '../auth/auth.http.js';
import { updateSettingsSchema, acceptingOrdersSchema } from './settings.schemas.js';

const actor = (req) => ({ userId: req.admin.userId, ip: req.ip });

// Public, read-only view for the customer app. Mounted at /api/cafe.
export function createCafePublicRouter({ service }) {
  const router = Router();
  router.get('/', async (_req, res) => {
    res.set('Cache-Control', 'public, max-age=10');
    res.json(await service.getPublic());
  });
  return router;
}

// Dashboard endpoints. Mounted at /api/settings.
export function createSettingsRouter({ service, adminStore }) {
  const router = Router();
  const ownerOnly = requireCurrentRole(adminStore, ROLE_OWNER);
  const ownerOrStaff = requireCurrentRole(adminStore, ROLE_OWNER, ROLE_STAFF);

  router.use(noStore, requireAuth, requireStaff);

  router.get('/', async (_req, res) => {
    res.json(await service.getFull());
  });

  router.patch('/', ownerOnly, validate(updateSettingsSchema), async (req, res) => {
    res.json(await service.update({ actor: actor(req), patch: req.body }));
  });

  // The counter staff need this switch too (close orders when the kitchen is overloaded).
  router.patch(
    '/accepting-orders',
    ownerOrStaff,
    validate(acceptingOrdersSchema),
    async (req, res) => {
      res.json(
        await service.setAcceptingOrders({
          actor: actor(req),
          acceptingOrders: req.body.acceptingOrders,
        }),
      );
    },
  );

  return router;
}
