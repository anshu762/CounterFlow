import { AppError } from '../utils/errors.js';

// Use after requireAuth + requireStaff. The role inside a JWT can be up to 15 minutes old,
// so sensitive routes re-check the account in the database.
export const requireCurrentRole =
  (store, ...allowed) =>
  async (req, _res, next) => {
    const admin = await store.findAdminById(req.auth.userId);
    if (!admin || !admin.is_active) {
      throw new AppError('Please sign in to continue', 401, 'AUTH_REQUIRED');
    }
    if (!allowed.includes(admin.role)) {
      throw new AppError('You do not have permission to do this', 403, 'FORBIDDEN');
    }
    req.admin = { userId: admin.user_id, role: admin.role, name: admin.name };
    next();
  };
