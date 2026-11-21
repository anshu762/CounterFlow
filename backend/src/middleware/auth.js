import { AppError } from '../utils/errors.js';
import { ALL_ROLES, ROLE_CUSTOMER, ROLE_OWNER, ROLE_STAFF } from '../modules/auth/roles.js';
import { verifyAccessToken } from '../modules/auth/tokens.js';

// Reads "Authorization: Bearer <jwt>" and sets req.auth = { userId, role }.
export function requireAuth(req, _res, next) {
  const [scheme, token] = (req.get('authorization') || '').split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    throw new AppError('Please sign in to continue', 401, 'AUTH_REQUIRED');
  }
  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new AppError('Your session has expired', 401, 'TOKEN_EXPIRED');
    }
    throw new AppError('Invalid token', 401, 'INVALID_TOKEN');
  }
  if (!payload.sub || !ALL_ROLES.includes(payload.role)) {
    throw new AppError('Invalid token', 401, 'INVALID_TOKEN');
  }
  req.auth = { userId: payload.sub, role: payload.role };
  next();
}

// Use after requireAuth: requireRole('owner'), requireRole('owner', 'staff')
export const requireRole =
  (...allowed) =>
  (req, _res, next) => {
    if (!req.auth) throw new AppError('Please sign in to continue', 401, 'AUTH_REQUIRED');
    if (!allowed.includes(req.auth.role)) {
      throw new AppError('You do not have permission to do this', 403, 'FORBIDDEN');
    }
    next();
  };

export const requireOwner = requireRole(ROLE_OWNER);
export const requireStaff = requireRole(ROLE_OWNER, ROLE_STAFF); // dashboard users
export const requireCustomer = requireRole(ROLE_CUSTOMER); // mobile app users
