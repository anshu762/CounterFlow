import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/errors.js';
import { signAccessToken } from './tokens.js';
import { ROLE_CUSTOMER } from './roles.js';
import { DuplicateCustomerError } from './auth.errors.js';

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
const newRefreshToken = () => crypto.randomBytes(48).toString('base64url');

// A "subject" is whoever a session belongs to: a staff user or a customer.
const adminSubject = (u) => ({
  kind: 'admin',
  id: u.user_id,
  role: u.role,
  user: { id: u.user_id, name: u.name, email: u.email, role: u.role },
});

const customerSubject = (c) => ({
  kind: 'customer',
  id: c.customer_id,
  role: ROLE_CUSTOMER,
  user: {
    id: c.customer_id,
    name: c.name,
    phone: c.phone,
    email: c.email ?? null,
    role: ROLE_CUSTOMER,
  },
});

const invalidRefresh = () =>
  new AppError('Your session is no longer valid. Please sign in again.', 401, 'REFRESH_INVALID');
const reusedRefresh = () =>
  new AppError('This session was already used. Please sign in again.', 401, 'REFRESH_REUSED');
const disabledAccount = (message) => new AppError(message, 403, 'ACCOUNT_DISABLED');

const noopAudit = { async record() {} };

let dummyHash;
// Compared against when the account is unknown, so response time does not reveal who exists.
async function getDummyHash() {
  dummyHash ??= await bcrypt.hash('not-a-real-password', env.bcryptRounds);
  return dummyHash;
}

export function createAuthService({ store, audit = noopAudit, now = () => new Date() }) {
  function buildRefreshRecord(subject, familyId, meta = {}) {
    const refreshToken = newRefreshToken();
    return {
      refreshToken,
      record: {
        tokenId: crypto.randomUUID(),
        familyId,
        adminUserId: subject.kind === 'admin' ? subject.id : null,
        customerId: subject.kind === 'customer' ? subject.id : null,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(now().getTime() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000),
        ip: meta.ip ?? null,
        userAgent: (meta.userAgent ?? '').slice(0, 300) || null,
      },
    };
  }

  function buildResponse(subject, refreshToken) {
    const { token, expiresIn } = signAccessToken({ userId: subject.id, role: subject.role });
    return {
      accessToken: token,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn,
      user: subject.user,
    };
  }

  // New sign-in = new token family.
  async function startSession(subject, meta) {
    const { refreshToken, record } = buildRefreshRecord(subject, crypto.randomUUID(), meta);
    await store.insertRefreshToken(record);
    store.purgeExpired().catch(() => {}); // housekeeping; never blocks a sign-in
    return buildResponse(subject, refreshToken);
  }

  // ---------- staff (owner / staff) ----------

  async function login({ email, password, ip, userAgent }) {
    const user = await store.findAdminByEmail(email);
    const passwordOk = await bcrypt.compare(
      password,
      user?.password_hash ?? (await getDummyHash()),
    );
    if (!user || !passwordOk) {
      throw new AppError('Incorrect email or password', 401, 'INVALID_CREDENTIALS');
    }
    if (!user.is_active) {
      throw disabledAccount('This account has been deactivated. Please contact the owner.');
    }
    await store.touchLastLogin(user.user_id);
    return startSession(adminSubject(user), { ip, userAgent });
  }

  async function me(userId) {
    const user = await store.findAdminById(userId);
    if (!user || !user.is_active) {
      throw new AppError('Please sign in to continue', 401, 'AUTH_REQUIRED');
    }
    return { user: adminSubject(user).user };
  }

  // Changes the signed-in staff member's own password, signs them out everywhere,
  // and returns a brand-new session so the current device stays signed in.
  async function changeAdminPassword({ userId, currentPassword, newPassword, ip, userAgent }) {
    const user = await store.findAdminById(userId);
    if (!user || !user.is_active) {
      throw new AppError('Please sign in to continue', 401, 'AUTH_REQUIRED');
    }
    const ok = await bcrypt.compare(currentPassword, user.password_hash);
    if (!ok) {
      throw new AppError('Your current password is incorrect', 400, 'INVALID_CURRENT_PASSWORD');
    }
    const passwordHash = await bcrypt.hash(newPassword, env.bcryptRounds);
    await store.setAdminPassword(user.user_id, passwordHash);
    await store.revokeAllForAdmin(user.user_id);
    await audit.record({
      actorId: user.user_id,
      action: 'auth.password_changed',
      entityType: 'admin_user',
      entityId: user.user_id,
      ip,
    });
    return startSession(adminSubject(user), { ip, userAgent });
  }

  // ---------- customers ----------

  async function customerSignup({ name, phone, email, password, ip, userAgent }) {
    const passwordHash = await bcrypt.hash(password, env.bcryptRounds);
    let customer;
    try {
      customer = await store.createCustomer({ name, phone, email: email ?? null, passwordHash });
    } catch (err) {
      if (err instanceof DuplicateCustomerError) {
        throw err.field === 'email'
          ? new AppError(
              'An account with this email already exists. Try signing in.',
              409,
              'EMAIL_TAKEN',
            )
          : new AppError(
              'An account with this phone number already exists. Try signing in.',
              409,
              'PHONE_TAKEN',
            );
      }
      throw err;
    }
    return startSession(customerSubject(customer), { ip, userAgent });
  }

  async function customerLogin({ identifier, password, ip, userAgent }) {
    const customer = identifier.includes('@')
      ? await store.findCustomerByEmail(identifier)
      : await store.findCustomerByPhone(identifier);
    const passwordOk = await bcrypt.compare(
      password,
      customer?.password_hash ?? (await getDummyHash()),
    );
    if (!customer || !passwordOk) {
      throw new AppError('Incorrect phone number, email or password', 401, 'INVALID_CREDENTIALS');
    }
    if (!customer.is_active) {
      throw disabledAccount('This account has been deactivated. Please contact the café.');
    }
    return startSession(customerSubject(customer), { ip, userAgent });
  }

  async function customerMe(customerId) {
    const customer = await store.findCustomerById(customerId);
    if (!customer || !customer.is_active) {
      throw new AppError('Please sign in to continue', 401, 'AUTH_REQUIRED');
    }
    return { user: customerSubject(customer).user };
  }

  // ---------- shared by both kinds of account ----------

  async function loadSubject(row) {
    if (row.admin_user_id) {
      const user = await store.findAdminById(row.admin_user_id);
      return user && user.is_active ? adminSubject(user) : null;
    }
    if (row.customer_id) {
      const customer = await store.findCustomerById(row.customer_id);
      return customer && customer.is_active ? customerSubject(customer) : null;
    }
    return null;
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

    const subject = await loadSubject(row);
    if (!subject) {
      await store.revokeFamily(row.family_id);
      throw invalidRefresh();
    }

    const next = buildRefreshRecord(subject, row.family_id, { ip, userAgent });
    const rotated = await store.rotateRefreshToken(row.token_id, next.record);
    if (!rotated) {
      await store.revokeFamily(row.family_id);
      throw reusedRefresh();
    }
    return buildResponse(subject, next.refreshToken);
  }

  async function logout({ refreshToken }) {
    const row = await store.findRefreshToken(hashToken(refreshToken));
    if (row) await store.revokeFamily(row.family_id);
  }

  return {
    login,
    me,
    changeAdminPassword,
    customerSignup,
    customerLogin,
    customerMe,
    refresh,
    logout,
  };
}
