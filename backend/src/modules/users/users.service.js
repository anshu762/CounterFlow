import bcrypt from 'bcryptjs';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/errors.js';
import { DuplicateAdminEmailError, LastOwnerError } from '../auth/auth.errors.js';

const toPublic = (u) => ({
  id: u.user_id,
  name: u.name,
  email: u.email,
  role: u.role,
  isActive: u.is_active,
  lastLoginAt: u.last_login_at ?? null,
});

const notFound = () => new AppError('User not found', 404, 'USER_NOT_FOUND');

function mapStoreError(err) {
  if (err instanceof DuplicateAdminEmailError) {
    return new AppError('Another user already uses this email', 409, 'EMAIL_TAKEN');
  }
  if (err instanceof LastOwnerError) {
    return new AppError('There must always be at least one active owner', 409, 'LAST_OWNER');
  }
  return err;
}

// actor = { userId, ip } of the signed-in owner performing the action.
export function createUsersService({ store, audit }) {
  async function list() {
    return { users: (await store.listAdmins()).map(toPublic) };
  }

  async function create({ actor, name, email, role, password }) {
    const passwordHash = await bcrypt.hash(password, env.bcryptRounds);
    let user;
    try {
      user = await store.createAdmin({ name, email, passwordHash, role });
    } catch (err) {
      throw mapStoreError(err);
    }
    await audit.record({
      actorId: actor.userId,
      action: 'user.create',
      entityType: 'admin_user',
      entityId: user.user_id,
      metadata: { email: user.email, role: user.role },
      ip: actor.ip,
    });
    return { user: toPublic(user) };
  }

  async function update({ actor, id, patch }) {
    const changes = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));

    if (
      id === actor.userId &&
      (changes.isActive === false || (changes.role !== undefined && changes.role !== 'owner'))
    ) {
      throw new AppError(
        'You cannot deactivate or demote your own account',
        400,
        'CANNOT_MODIFY_SELF',
      );
    }

    const before = await store.findAdminById(id);
    if (!before) throw notFound();

    let user;
    try {
      user = await store.updateAdmin(id, changes);
    } catch (err) {
      throw mapStoreError(err);
    }
    if (!user) throw notFound();

    // Deactivated or re-roled users must sign in again.
    if (
      changes.isActive === false ||
      (changes.role !== undefined && changes.role !== before.role)
    ) {
      await store.revokeAllForAdmin(id);
    }

    await audit.record({
      actorId: actor.userId,
      action: 'user.update',
      entityType: 'admin_user',
      entityId: id,
      metadata: { fields: Object.keys(changes), ...changes },
      ip: actor.ip,
    });
    return { user: toPublic(user) };
  }

  async function resetPassword({ actor, id, newPassword }) {
    if (id === actor.userId) {
      throw new AppError('Use "change password" for your own account', 400, 'USE_CHANGE_PASSWORD');
    }
    const target = await store.findAdminById(id);
    if (!target) throw notFound();

    const passwordHash = await bcrypt.hash(newPassword, env.bcryptRounds);
    await store.setAdminPassword(id, passwordHash);
    await store.revokeAllForAdmin(id);
    await audit.record({
      actorId: actor.userId,
      action: 'user.reset_password',
      entityType: 'admin_user',
      entityId: id,
      ip: actor.ip,
    });
  }

  return { list, create, update, resetPassword };
}
