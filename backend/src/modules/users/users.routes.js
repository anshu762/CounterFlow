import { Router } from 'express';
import { validate, validateParams } from '../../middleware/validate.js';
import { requireAuth, requireStaff } from '../../middleware/auth.js';
import { requireCurrentRole } from '../../middleware/freshAuth.js';
import { ROLE_OWNER } from '../auth/roles.js';
import { noStore } from '../auth/auth.http.js';
import {
  idParamsSchema,
  createUserSchema,
  updateUserSchema,
  resetPasswordSchema,
} from './users.schemas.js';

const actor = (req) => ({ userId: req.admin.userId, ip: req.ip });

// Owner-only user management. Mounted at /api/users.
export function createUsersRouter({ service, adminStore }) {
  const router = Router();

  router.use(noStore, requireAuth, requireStaff, requireCurrentRole(adminStore, ROLE_OWNER));

  router.get('/', async (_req, res) => {
    res.json(await service.list());
  });

  router.post('/', validate(createUserSchema), async (req, res) => {
    res.status(201).json(await service.create({ actor: actor(req), ...req.body }));
  });

  router.patch(
    '/:id',
    validateParams(idParamsSchema),
    validate(updateUserSchema),
    async (req, res) => {
      res.json(await service.update({ actor: actor(req), id: req.params.id, patch: req.body }));
    },
  );

  router.post(
    '/:id/reset-password',
    validateParams(idParamsSchema),
    validate(resetPasswordSchema),
    async (req, res) => {
      await service.resetPassword({
        actor: actor(req),
        id: req.params.id,
        newPassword: req.body.newPassword,
      });
      res.status(204).end();
    },
  );

  return router;
}
