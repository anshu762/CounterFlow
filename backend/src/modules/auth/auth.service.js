import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/errors.js';
import { signAccessToken } from './tokens.js';

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
const newRefreshToken = () => crypto.randomBytes(48).toString('base64url');

const publicUser = (u) => ({ id: u.user_id, name: u.name, email: u.email, role: u.role });

const invalidRefresh = () =>
  new AppError('Your session is no longer valid. Please sign in again.', 401, 'REFRESH_INVALID');
const reusedRefresh = () =>
  new AppError('This session was already used. Please sign in again.', 401, 'REFRESH_REUSED');

let dummyHash;
// Compared against when the email is unknown, so response time does not reveal which emails exist.
async function getDummyHash() {
  dummyHash ??= await bcrypt.hash('not-a-real-password', env.bcryptRounds);
  return dummyHash;
}

export function createAuthService({ store, now = () => new Date() }) {
  function buildRefreshRecord(user, familyId, meta = {}) {
    const refreshToken = newRefreshToken();
    return {
      refreshToken,
      record: {
        tokenId: crypto.randomUUID(),
        familyId,
        adminUserId: user.user_id,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(now().getTime() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000),
        ip: meta.ip ?? null,
        userAgent: (meta.userAgent ?? '').slice(0, 300) || null,
      },
    };
  }

  function buildResponse(user, refreshToken) {
    const { token, expiresIn } = signAccessToken({ userId: user.user_id, role: user.role });
    return {
      accessToken: token,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn,
      user: publicUser(user),
    };
  }

  async function login({ email, password, ip, userAgent }) {
    const user = await store.findAdminByEmail(email);
    const passwordOk = await bcrypt.compare(password, user?.password_hash ?? (await getDummyHash()));
    if (!user || !passwordOk) {
      throw new AppError('Incorrect email or password', 401, 'INVALID_CREDENTIALS');
    }
    if (!user.is_active) {
      throw new AppError(
        'This account has been deactivated. Please contact the owner.',
        403,
        'ACCOUNT_DISABLED',
      );
    }
    const { refreshToken, record } = buildRefreshRecord(user, crypto.randomUUID(), {
      ip,
      userAgent,
    });
    await store.insertRefreshToken(record);
    await store.touchLastLogin(user.user_id);
    store.purgeExpired().catch(() => {}); // housekeeping; never blocks a login
    return buildResponse(user, refreshToken);
  }

  async function refresh({ refreshToken, ip, userAgent }) {
    const row = await store.findRefreshToken(hashToken(refreshToken));
    if (!row) throw invalidRefresh();

    if (row.revoked_at) {
      // A token that was already rotated is being used again: treat as theft, kill the family.
      if (row.replaced_by) {
        await store.revokeFamily(row.family_id);
        throw reusedRefresh();
      }
      throw invalidRefresh(); // revoked by logout
    }
    if (new Date(row.expires_at) <= now()) throw invalidRefresh();

    const user = row.admin_user_id ? await store.findAdminById(row.admin_user_id) : null;
    if (!user || !user.is_active) {
      await store.revokeFamily(row.family_id);
      throw invalidRefresh();
    }

    const next = buildRefreshRecord(user, row.family_id, { ip, userAgent });
    const rotated = await store.rotateRefreshToken(row.token_id, next.record);
    if (!rotated) {
      await store.revokeFamily(row.family_id);
      throw reusedRefresh();
    }
    return buildResponse(user, next.refreshToken);
  }

  async function logout({ refreshToken }) {
    const row = await store.findRefreshToken(hashToken(refreshToken));
    if (row) await store.revokeFamily(row.family_id);
  }

  async function me(userId) {
    const user = await store.findAdminById(userId);
    if (!user || !user.is_active) {
      throw new AppError('Please sign in to continue', 401, 'AUTH_REQUIRED');
    }
    return { user: publicUser(user) };
  }

  return { login, refresh, logout, me };
}