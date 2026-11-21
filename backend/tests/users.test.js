import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app.js';
import { signAccessToken } from '../src/modules/auth/tokens.js';
import { LastOwnerError } from '../src/modules/auth/auth.errors.js';
import { createPgAuthStore } from '../src/modules/auth/auth.store.js';
import { createMemoryAuthStore } from './helpers/memoryAuthStore.js';
import { createMemoryAuditLog } from './helpers/memoryAuditLog.js';
import { createMemorySettingsStore } from './helpers/memorySettingsStore.js';

const PASSWORD = 'Correct-Horse-123';
const NEW_PASSWORD = 'Brand-New-Pass-77';
const HASH = bcrypt.hashSync(PASSWORD, 4);
const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const STAFF_ID = '22222222-2222-4222-8222-222222222222';
const GUEST_ID = '44444444-4444-4444-8444-444444444444';
const OWNER2_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const MISSING_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const admin = (id, email, role) => ({
  user_id: id,
  name: `${role} user`,
  email,
  password_hash: HASH,
  role,
  is_active: true,
  last_login_at: null,
});
const auth = (id, role) => ({
  Authorization: `Bearer ${signAccessToken({ userId: id, role }).token}`,
});
const ownerAuth = () => auth(OWNER_ID, 'owner');

let store;
let audit;
let app;

beforeEach(() => {
  store = createMemoryAuthStore({
    users: [
      admin(OWNER_ID, 'owner@cafe.test', 'owner'),
      admin(STAFF_ID, 'staff@cafe.test', 'staff'),
    ],
  });
  audit = createMemoryAuditLog();
  app = createApp({
    authStore: store,
    settingsStore: createMemorySettingsStore(),
    auditLog: audit,
    loginRateLimit: { limit: 1000 },
    refreshRateLimit: { limit: 1000 },
  });
});

const staffLogin = (email = 'staff@cafe.test', password = PASSWORD) =>
  request(app).post('/api/auth/login').send({ email, password });
const refresh = (refreshToken) => request(app).post('/api/auth/refresh').send({ refreshToken });
const list = (headers = ownerAuth()) => request(app).get('/api/users').set(headers);
const create = (body, headers = ownerAuth()) =>
  request(app).post('/api/users').set(headers).send(body);
const update = (id, body, headers = ownerAuth()) =>
  request(app).patch(`/api/users/${id}`).set(headers).send(body);
const reset = (id, body, headers = ownerAuth()) =>
  request(app).post(`/api/users/${id}/reset-password`).set(headers).send(body);

describe('access control', () => {
  it('rejects anonymous, staff and customer tokens', async () => {
    expect((await list({})).status).toBe(401);
    expect((await list(auth(STAFF_ID, 'staff'))).status).toBe(403);
    expect((await list(auth(GUEST_ID, 'customer'))).status).toBe(403);
  });

  it('refuses a demoted owner holding an old token', async () => {
    store._admins.get(OWNER_ID).role = 'staff';
    expect((await list()).status).toBe(403);
  });

  it('refuses a deactivated owner holding an old token', async () => {
    store._admins.get(OWNER_ID).is_active = false;
    expect((await list()).status).toBe(401);
  });

  it('lets the owner list users without any password data', async () => {
    const res = await list();
    expect(res.status).toBe(200);
    expect(res.body.users).toHaveLength(2);
    expect(res.body.users[0]).toHaveProperty('isActive');
    expect(JSON.stringify(res.body)).not.toContain('password');
  });
});

describe('POST /api/users', () => {
  const body = { name: 'Ravi Kumar', email: 'Ravi@Cafe.test', password: NEW_PASSWORD };

  it('creates a staff user by default, who can then sign in', async () => {
    const res = await create(body);
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({
      name: 'Ravi Kumar',
      email: 'ravi@cafe.test',
      role: 'staff',
      isActive: true,
    });
    const saved = [...store._admins.values()].find((u) => u.email === 'ravi@cafe.test');
    expect(saved.password_hash.startsWith('$2')).toBe(true);
    expect((await staffLogin('ravi@cafe.test', NEW_PASSWORD)).status).toBe(200);
  });

  it('can create another owner', async () => {
    const res = await create({ ...body, role: 'owner' });
    expect(res.body.user.role).toBe('owner');
  });

  it('writes an audit entry without the password', async () => {
    await create(body);
    expect(audit.entries[0]).toMatchObject({
      actorId: OWNER_ID,
      action: 'user.create',
      metadata: { email: 'ravi@cafe.test', role: 'staff' },
    });
    expect(JSON.stringify(audit.entries)).not.toContain(NEW_PASSWORD);
  });

  it('rejects a duplicate email, ignoring letter case', async () => {
    const res = await create({ ...body, email: 'STAFF@cafe.test' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it.each([
    ['short password', { password: 'Short1' }],
    ['password without a number', { password: 'OnlyLettersHere' }],
    ['password without a letter', { password: '1234567890' }],
    ['unknown role', { role: 'superuser' }],
    ['invalid email', { email: 'nope' }],
    ['extra field', { isAdmin: true }],
  ])('validates input: %s', async (_label, extra) => {
    const res = await create({ ...body, ...extra });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('is owner-only', async () => {
    expect((await create(body, auth(STAFF_ID, 'staff'))).status).toBe(403);
  });
});

describe('PATCH /api/users/:id', () => {
  it('renames a user and records the change', async () => {
    const res = await update(STAFF_ID, { name: 'Counter Staff' });
    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe('Counter Staff');
    expect(audit.entries[0]).toMatchObject({
      action: 'user.update',
      entityId: STAFF_ID,
      metadata: { fields: ['name'], name: 'Counter Staff' },
    });
  });

  it('deactivating signs the user out everywhere and blocks new sign-ins', async () => {
    const session = (await staffLogin()).body;
    const res = await update(STAFF_ID, { isActive: false });
    expect(res.body.user.isActive).toBe(false);

    const afterwards = await refresh(session.refreshToken);
    expect(afterwards.status).toBe(401);
    expect(afterwards.body.error.code).toBe('REFRESH_INVALID');

    const again = await staffLogin();
    expect(again.status).toBe(403);
    expect(again.body.error.code).toBe('ACCOUNT_DISABLED');
  });

  it('changing a role signs that user out so the new role applies', async () => {
    const session = (await staffLogin()).body;
    expect((await update(STAFF_ID, { role: 'owner' })).status).toBe(200);
    expect((await refresh(session.refreshToken)).status).toBe(401);
    const login = await staffLogin();
    expect(login.body.user.role).toBe('owner');
  });

  it('rejects an email another user already has', async () => {
    const res = await update(STAFF_ID, { email: 'OWNER@cafe.test' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('returns 404 for an unknown user and 400 for a malformed id', async () => {
    expect((await update(MISSING_ID, { name: 'Nobody' })).status).toBe(404);
    expect((await update('not-a-uuid', { name: 'Nobody' })).status).toBe(400);
  });

  it('rejects empty and unknown fields', async () => {
    expect((await update(STAFF_ID, {})).status).toBe(400);
    expect((await update(STAFF_ID, { password: 'x' })).status).toBe(400);
  });

  it('stops an owner deactivating or demoting themselves', async () => {
    const off = await update(OWNER_ID, { isActive: false });
    expect(off.status).toBe(400);
    expect(off.body.error.code).toBe('CANNOT_MODIFY_SELF');
    expect((await update(OWNER_ID, { role: 'staff' })).status).toBe(400);
    expect(store._admins.get(OWNER_ID).role).toBe('owner');
  });

  it('lets one owner demote another while an owner remains', async () => {
    store._admins.set(OWNER2_ID, admin(OWNER2_ID, 'owner2@cafe.test', 'owner'));
    const res = await update(OWNER2_ID, { role: 'staff' });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('staff');
  });
});

describe('last owner protection (store level)', () => {
  it('memory store refuses to deactivate or demote the only owner', async () => {
    await expect(store.updateAdmin(OWNER_ID, { isActive: false })).rejects.toBeInstanceOf(
      LastOwnerError,
    );
    await expect(store.updateAdmin(OWNER_ID, { role: 'staff' })).rejects.toBeInstanceOf(
      LastOwnerError,
    );
    expect(store._admins.get(OWNER_ID).is_active).toBe(true);
  });

  it('memory store allows it once a second owner exists', async () => {
    store._admins.set(OWNER2_ID, admin(OWNER2_ID, 'owner2@cafe.test', 'owner'));
    const result = await store.updateAdmin(OWNER_ID, { isActive: false });
    expect(result.is_active).toBe(false);
  });

  it('Postgres store rolls back and never runs the update when no other owner exists', async () => {
    const queries = [];
    let released = false;
    const client = {
      async query(sql) {
        const q = sql.replace(/\s+/g, ' ').trim().toLowerCase();
        queries.push(q);
        if (q === 'begin' || q === 'rollback' || q === 'commit') return { rows: [], rowCount: 0 };
        if (q.includes('count(*)')) return { rows: [{ n: 0 }] };
        if (q.includes('where user_id = $1 for update')) {
          return { rows: [{ user_id: OWNER_ID, role: 'owner', is_active: true }] };
        }
        if (q.includes("role = 'owner'") && q.endsWith('for update')) {
          return { rows: [{ user_id: OWNER_ID }] };
        }
        throw new Error(`unexpected query: ${q}`);
      },
      release() {
        released = true;
      },
    };
    const pgStore = createPgAuthStore({ connect: async () => client });
    await expect(pgStore.updateAdmin(OWNER_ID, { isActive: false })).rejects.toBeInstanceOf(
      LastOwnerError,
    );
    expect(queries).toContain('rollback');
    expect(queries.some((q) => q.startsWith('update admin_users'))).toBe(false);
    expect(released).toBe(true);
  });
});

describe('POST /api/users/:id/reset-password', () => {
  it('resets the password, signs the user out, and the new password works', async () => {
    const session = (await staffLogin()).body;
    const res = await reset(STAFF_ID, { newPassword: NEW_PASSWORD });
    expect(res.status).toBe(204);

    expect((await refresh(session.refreshToken)).status).toBe(401);
    expect((await staffLogin('staff@cafe.test', PASSWORD)).status).toBe(401);
    expect((await staffLogin('staff@cafe.test', NEW_PASSWORD)).status).toBe(200);

    expect(audit.entries[0]).toMatchObject({ action: 'user.reset_password', entityId: STAFF_ID });
    expect(JSON.stringify(audit.entries)).not.toContain(NEW_PASSWORD);
  });

  it('sends owners to "change password" for their own account', async () => {
    const res = await reset(OWNER_ID, { newPassword: NEW_PASSWORD });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('USE_CHANGE_PASSWORD');
  });

  it('rejects weak passwords, unknown users and non-owners', async () => {
    expect((await reset(STAFF_ID, { newPassword: 'weak' })).status).toBe(400);
    expect((await reset(MISSING_ID, { newPassword: NEW_PASSWORD })).status).toBe(404);
    expect(
      (await reset(STAFF_ID, { newPassword: NEW_PASSWORD }, auth(STAFF_ID, 'staff'))).status,
    ).toBe(403);
  });
});

describe('POST /api/auth/change-password', () => {
  const change = (body, headers) =>
    request(app).post('/api/auth/change-password').set(headers).send(body);
  const staffHeaders = () => auth(STAFF_ID, 'staff');

  it('changes the password, ends old sessions and returns a fresh session', async () => {
    const old = (await staffLogin()).body;
    const res = await change(
      { currentPassword: PASSWORD, newPassword: NEW_PASSWORD },
      staffHeaders(),
    );
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.user.role).toBe('staff');

    expect((await refresh(old.refreshToken)).status).toBe(401);
    expect((await refresh(res.body.refreshToken)).status).toBe(200);
    expect((await staffLogin('staff@cafe.test', PASSWORD)).status).toBe(401);
    expect((await staffLogin('staff@cafe.test', NEW_PASSWORD)).status).toBe(200);

    expect(audit.entries[0]).toMatchObject({
      actorId: STAFF_ID,
      action: 'auth.password_changed',
    });
  });

  it('rejects a wrong current password', async () => {
    const res = await change(
      { currentPassword: 'Wrong-Password-1', newPassword: NEW_PASSWORD },
      staffHeaders(),
    );
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_CURRENT_PASSWORD');
    expect((await staffLogin()).status).toBe(200);
  });

  it('rejects a weak or unchanged new password', async () => {
    expect(
      (await change({ currentPassword: PASSWORD, newPassword: 'weak' }, staffHeaders())).status,
    ).toBe(400);
    expect(
      (await change({ currentPassword: PASSWORD, newPassword: PASSWORD }, staffHeaders())).status,
    ).toBe(400);
  });

  it('requires a staff sign-in', async () => {
    const body = { currentPassword: PASSWORD, newPassword: NEW_PASSWORD };
    expect((await change(body, {})).status).toBe(401);
    expect((await change(body, auth(GUEST_ID, 'customer'))).status).toBe(403);
  });
});
