import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app.js';
import { errorHandler } from '../src/middleware/error.js';
import { requireAuth, requireOwner } from '../src/middleware/auth.js';
import { signAccessToken } from '../src/modules/auth/tokens.js';
import { normalizePhone } from '../src/utils/phone.js';
import { createMemoryAuthStore } from './helpers/memoryAuthStore.js';

const PASSWORD = 'Masala-Chai-42';
const HASH = bcrypt.hashSync(PASSWORD, 4);
const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const GUEST_ID = '44444444-4444-4444-8444-444444444444';
const OFF_ID = '55555555-5555-4555-8555-555555555555';

let store;
let app;

beforeEach(() => {
  store = createMemoryAuthStore({
    users: [
      {
        user_id: OWNER_ID,
        name: 'Owner',
        email: 'owner@cafe.test',
        password_hash: HASH,
        role: 'owner',
        is_active: true,
        last_login_at: null,
      },
    ],
    customers: [
      {
        customer_id: GUEST_ID,
        name: 'Existing Guest',
        phone: '+919811122233',
        email: 'guest@example.com',
        password_hash: HASH,
        is_active: true,
      },
      {
        customer_id: OFF_ID,
        name: 'Disabled Guest',
        phone: '+919800000000',
        email: null,
        password_hash: HASH,
        is_active: false,
      },
    ],
  });
  app = createApp({
    authStore: store,
    loginRateLimit: { limit: 1000 },
    refreshRateLimit: { limit: 1000 },
    signupRateLimit: { limit: 1000 },
  });
});

const signup = (body = {}) =>
  request(app)
    .post('/api/customer/auth/signup')
    .send({ name: 'Asha Kaur', phone: '98765 43210', password: PASSWORD, ...body });
const login = (identifier = '9811122233', password = PASSWORD) =>
  request(app).post('/api/customer/auth/login').send({ identifier, password });
const refresh = (refreshToken) =>
  request(app).post('/api/customer/auth/refresh').send({ refreshToken });
const me = (token) =>
  request(app).get('/api/customer/auth/me').set('Authorization', `Bearer ${token}`);
const staffMe = (token) => request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
const staffLogin = () =>
  request(app).post('/api/auth/login').send({ email: 'owner@cafe.test', password: PASSWORD });

describe('normalizePhone', () => {
  it('normalises common Indian formats', () => {
    expect(normalizePhone('98765 43210')).toBe('+919876543210');
    expect(normalizePhone('098765-43210')).toBe('+919876543210');
    expect(normalizePhone('+91 (98765) 43210')).toBe('+919876543210');
    expect(normalizePhone('919876543210')).toBe('+919876543210');
  });
  it('keeps international numbers that start with +', () => {
    expect(normalizePhone('+14155552671')).toBe('+14155552671');
  });
  it('rejects invalid numbers', () => {
    expect(normalizePhone('12345')).toBeNull();
    expect(normalizePhone('5876543210')).toBeNull();
    expect(normalizePhone('abcdefghij')).toBeNull();
    expect(normalizePhone('')).toBeNull();
  });
});

describe('POST /api/customer/auth/signup', () => {
  it('creates the account and signs the customer in', async () => {
    const res = await signup();
    expect(res.status).toBe(201);
    expect(res.body.tokenType).toBe('Bearer');
    expect(res.body.user).toMatchObject({
      name: 'Asha Kaur',
      phone: '+919876543210',
      email: null,
      role: 'customer',
    });
    expect(JSON.stringify(res.body)).not.toContain('password');
    expect((await me(res.body.accessToken)).status).toBe(200);
  });

  it('puts only the role (and subject) in the JWT', async () => {
    const res = await signup();
    const payload = jwt.decode(res.body.accessToken);
    expect(Object.keys(payload).sort()).toEqual(['exp', 'iat', 'iss', 'role', 'sub']);
    expect(payload.role).toBe('customer');
  });

  it('stores only a bcrypt hash of the password', async () => {
    await signup();
    const saved = [...store._customers.values()].find((c) => c.phone === '+919876543210');
    expect(saved.password_hash).not.toBe(PASSWORD);
    expect(saved.password_hash.startsWith('$2')).toBe(true);
  });

  it('stores the email in lower case when given', async () => {
    const res = await signup({ email: '  Asha@Example.COM ' });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('asha@example.com');
  });

  it('treats an empty email as "no email"', async () => {
    const res = await signup({ email: '' });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBeNull();
  });

  it('rejects a phone number that is already registered, in any format', async () => {
    expect((await signup()).status).toBe(201);
    const again = await signup({ phone: '+91 98765-43210' });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('PHONE_TAKEN');
  });

  it('rejects a phone number that belongs to an existing customer', async () => {
    const res = await signup({ phone: '+919811122233' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PHONE_TAKEN');
  });

  it('rejects an email that is already registered, ignoring letter case', async () => {
    const res = await signup({ phone: '9123456780', email: 'GUEST@example.com' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it.each([
    ['password too short', { password: 'short1' }],
    ['password without a number', { password: 'onlyletters' }],
    ['password without a letter', { password: '12345678' }],
    ['password too long', { password: `a1${'x'.repeat(80)}` }],
    ['invalid phone', { phone: '12345' }],
    ['missing name', { name: '' }],
    ['invalid email', { email: 'nope' }],
  ])('validates input: %s', async (_label, body) => {
    const res = await signup(body);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rate limits signups', async () => {
    const limited = createApp({ authStore: store, signupRateLimit: { limit: 2 } });
    const attempt = () =>
      request(limited)
        .post('/api/customer/auth/signup')
        .send({ name: 'Asha Kaur', phone: '9876543210', password: PASSWORD });
    expect((await attempt()).status).toBe(201);
    expect((await attempt()).status).toBe(409);
    const blocked = await attempt();
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
  });
});

describe('POST /api/customer/auth/login', () => {
  it('signs in with a phone number', async () => {
    const res = await login('9811122233');
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(GUEST_ID);
    expect(res.body.user.role).toBe('customer');
  });

  it('signs in with a phone number typed in another format', async () => {
    expect((await login('+91 98111-22233')).status).toBe(200);
  });

  it('signs in with an email in any letter case', async () => {
    expect((await login('  GUEST@Example.com ')).status).toBe(200);
  });

  it('works for an account created through signup', async () => {
    await signup();
    expect((await login('09876543210')).status).toBe(200);
  });

  it('rejects a wrong password', async () => {
    const res = await login('9811122233', 'wrong-password-1');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('gives the same answer for an unknown phone number', async () => {
    const wrong = await login('9811122233', 'wrong-password-1');
    const unknown = await login('9000000009', 'whatever-123');
    expect(unknown.status).toBe(401);
    expect(unknown.body.error.message).toBe(wrong.body.error.message);
  });

  it('blocks a deactivated account', async () => {
    const res = await login('9800000000');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_DISABLED');
  });

  it('validates the identifier', async () => {
    const res = await login('abc');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('does not let a customer sign in as staff, or staff as a customer', async () => {
    const asStaff = await request(app)
      .post('/api/auth/login')
      .send({ email: 'guest@example.com', password: PASSWORD });
    expect(asStaff.status).toBe(401);
    expect((await login('owner@cafe.test')).status).toBe(401);
  });

  it('rate limits repeated failed logins', async () => {
    const limited = createApp({ authStore: store, loginRateLimit: { limit: 3 } });
    const attempt = () =>
      request(limited)
        .post('/api/customer/auth/login')
        .send({ identifier: '9811122233', password: 'wrong-password-1' });
    for (let i = 0; i < 3; i++) expect((await attempt()).status).toBe(401);
    expect((await attempt()).status).toBe(429);
  });
});

describe('customer sessions', () => {
  it('GET /me returns the current customer', async () => {
    const { body } = await login();
    const res = await me(body.accessToken);
    expect(res.status).toBe(200);
    expect(res.body.user.phone).toBe('+919811122233');
  });

  it('GET /me requires a token', async () => {
    const res = await request(app).get('/api/customer/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_REQUIRED');
  });

  it('a customer token is refused on staff routes', async () => {
    const { body } = await login();
    const res = await staffMe(body.accessToken);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('a staff token is refused on customer routes', async () => {
    const { body } = await staffLogin();
    const res = await me(body.accessToken);
    expect(res.status).toBe(403);
  });

  it('a customer token cannot reach owner-only routes', async () => {
    const guarded = express();
    guarded.get('/owner-only', requireAuth, requireOwner, (_req, res) => res.json({ ok: true }));
    guarded.use(errorHandler);
    const { token } = signAccessToken({ userId: GUEST_ID, role: 'customer' });
    const res = await request(guarded).get('/owner-only').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('stops answering /me once the account is deactivated', async () => {
    const { body } = await login();
    store._customers.get(GUEST_ID).is_active = false;
    expect((await me(body.accessToken)).status).toBe(401);
  });
});

describe('customer refresh tokens', () => {
  it('saves the refresh token against the customer, not a staff user', async () => {
    await login();
    const [row] = [...store._tokens.values()];
    expect(row.customer_id).toBe(GUEST_ID);
    expect(row.admin_user_id).toBeNull();
  });

  it('rotates: returns a new pair and the new access token works', async () => {
    const first = (await login()).body;
    const res = await refresh(first.refreshToken);
    expect(res.status).toBe(200);
    expect(res.body.refreshToken).not.toBe(first.refreshToken);
    expect(res.body.user.role).toBe('customer');
    expect((await me(res.body.accessToken)).status).toBe(200);
  });

  it('detects reuse of an old token and revokes the whole family', async () => {
    const first = (await login()).body;
    const second = (await refresh(first.refreshToken)).body;

    const replay = await refresh(first.refreshToken);
    expect(replay.status).toBe(401);
    expect(replay.body.error.code).toBe('REFRESH_REUSED');
    expect((await refresh(second.refreshToken)).status).toBe(401);
  });

  it('refuses to refresh for a deactivated customer', async () => {
    const first = (await login()).body;
    store._customers.get(GUEST_ID).is_active = false;
    expect((await refresh(first.refreshToken)).status).toBe(401);
  });

  it('logout revokes the session', async () => {
    const first = (await login()).body;
    const out = await request(app)
      .post('/api/customer/auth/logout')
      .send({ refreshToken: first.refreshToken });
    expect(out.status).toBe(204);
    expect((await refresh(first.refreshToken)).status).toBe(401);
  });
});
