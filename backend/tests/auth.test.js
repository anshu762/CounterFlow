import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { errorHandler } from '../src/middleware/error.js';
import { requireAuth, requireOwner } from '../src/middleware/auth.js';
import { ACCESS_ISSUER, signAccessToken } from '../src/modules/auth/tokens.js';
import { createMemoryAuthStore } from './helpers/memoryAuthStore.js';

const PASSWORD = 'Correct-Horse-123';
const HASH = bcrypt.hashSync(PASSWORD, 4);
const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const STAFF_ID = '22222222-2222-4222-8222-222222222222';
const OFF_ID = '33333333-3333-4333-8333-333333333333';

const makeUser = (id, email, role, isActive = true) => ({
  user_id: id,
  name: `${role} user`,
  email,
  password_hash: HASH,
  role,
  is_active: isActive,
  last_login_at: null,
});

let store;
let app;

beforeEach(() => {
  store = createMemoryAuthStore({
    users: [
      makeUser(OWNER_ID, 'owner@cafe.test', 'owner'),
      makeUser(STAFF_ID, 'staff@cafe.test', 'staff'),
      makeUser(OFF_ID, 'off@cafe.test', 'staff', false),
    ],
  });
  app = createApp({
    authStore: store,
    loginRateLimit: { limit: 1000 },
    refreshRateLimit: { limit: 1000 },
  });
});

const login = (email = 'owner@cafe.test', password = PASSWORD) =>
  request(app).post('/api/auth/login').send({ email, password });
const refresh = (refreshToken) => request(app).post('/api/auth/refresh').send({ refreshToken });
const me = (token) => request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);

describe('POST /api/auth/login', () => {
  it('signs in and returns tokens plus the public user', async () => {
    const res = await login();
    expect(res.status).toBe(200);
    expect(res.body.tokenType).toBe('Bearer');
    expect(res.body.expiresIn).toBeGreaterThan(0);
    expect(res.body.user).toEqual({
      id: OWNER_ID,
      name: 'owner user',
      email: 'owner@cafe.test',
      role: 'owner',
    });
    expect(JSON.stringify(res.body)).not.toContain('password');
  });

  it('puts only the role (and subject) in the JWT: no tenant or other data', async () => {
    const res = await login();
    const payload = jwt.decode(res.body.accessToken);
    expect(Object.keys(payload).sort()).toEqual(['exp', 'iat', 'iss', 'role', 'sub']);
    expect(payload.role).toBe('owner');
    expect(payload.sub).toBe(OWNER_ID);
  });

  it('accepts the email in any letter case', async () => {
    const res = await login('  OWNER@Cafe.Test ');
    expect(res.status).toBe(200);
  });

  it('rejects a wrong password', async () => {
    const res = await login('owner@cafe.test', 'wrong-password');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('gives the same answer for an unknown email', async () => {
    const wrong = await login('owner@cafe.test', 'wrong-password');
    const unknown = await login('nobody@cafe.test', 'whatever-123');
    expect(unknown.status).toBe(401);
    expect(unknown.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(unknown.body.error.message).toBe(wrong.body.error.message);
  });

  it('blocks a deactivated account even with the right password', async () => {
    const res = await login('off@cafe.test');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_DISABLED');
  });

  it('validates the body', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('stores only a hash of the refresh token', async () => {
    const res = await login();
    const hashes = [...store._tokens.values()].map((t) => t.token_hash);
    expect(hashes).toHaveLength(1);
    expect(hashes[0]).not.toBe(res.body.refreshToken);
  });

  it('rate limits repeated failed logins', async () => {
    const limited = createApp({ authStore: store, loginRateLimit: { limit: 3 } });
    const attempt = () =>
      request(limited)
        .post('/api/auth/login')
        .send({ email: 'owner@cafe.test', password: 'wrong-password' });
    for (let i = 0; i < 3; i++) expect((await attempt()).status).toBe(401);
    const blocked = await attempt();
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
  });
});

describe('access tokens (GET /api/auth/me)', () => {
  it('returns the current user for a valid token', async () => {
    const { body } = await login();
    const res = await me(body.accessToken);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('owner@cafe.test');
  });

  it('requires a token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_REQUIRED');
  });

  it('rejects a garbage token', async () => {
    const res = await me('not.a.token');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  it('reports an expired token as TOKEN_EXPIRED', async () => {
    const expired = jwt.sign(
      { role: 'owner', exp: Math.floor(Date.now() / 1000) - 60 },
      env.JWT_ACCESS_SECRET,
      { subject: OWNER_ID, issuer: ACCESS_ISSUER, algorithm: 'HS256' },
    );
    const res = await me(expired);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
  });

  it('rejects a token signed with a different secret', async () => {
    const forged = jwt.sign({ role: 'owner' }, 'x'.repeat(40), {
      subject: OWNER_ID,
      issuer: ACCESS_ISSUER,
      expiresIn: 60,
    });
    const res = await me(forged);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  it('stops answering /me once the account is deactivated', async () => {
    const { body } = await login();
    store._admins.get(OWNER_ID).is_active = false;
    const res = await me(body.accessToken);
    expect(res.status).toBe(401);
  });
});

describe('refresh token rotation', () => {
  it('rotates: returns a new pair and the new access token works', async () => {
    const first = (await login()).body;
    const res = await refresh(first.refreshToken);
    expect(res.status).toBe(200);
    expect(res.body.refreshToken).not.toBe(first.refreshToken);
    expect((await me(res.body.accessToken)).status).toBe(200);
  });

  it('chains: each new refresh token can be used once', async () => {
    const first = (await login()).body;
    const second = (await refresh(first.refreshToken)).body;
    const third = await refresh(second.refreshToken);
    expect(third.status).toBe(200);
  });

  it('detects reuse of an old token and revokes the whole family', async () => {
    const first = (await login()).body;
    const second = (await refresh(first.refreshToken)).body;

    const replay = await refresh(first.refreshToken);
    expect(replay.status).toBe(401);
    expect(replay.body.error.code).toBe('REFRESH_REUSED');

    // The legitimate newest token is now dead too.
    const afterwards = await refresh(second.refreshToken);
    expect(afterwards.status).toBe(401);
  });

  it('rejects an unknown refresh token', async () => {
    const res = await refresh('x'.repeat(64));
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('REFRESH_INVALID');
  });

  it('rejects an expired refresh token', async () => {
    const first = (await login()).body;
    for (const t of store._tokens.values()) t.expires_at = new Date(Date.now() - 1000);
    const res = await refresh(first.refreshToken);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('REFRESH_INVALID');
  });

  it('refuses to refresh for a deactivated account', async () => {
    const first = (await login()).body;
    store._admins.get(OWNER_ID).is_active = false;
    const res = await refresh(first.refreshToken);
    expect(res.status).toBe(401);
  });

  it('keeps separate sign-ins independent', async () => {
    const a = (await login()).body;
    const b = (await login()).body;
    await refresh(a.refreshToken);
    expect((await refresh(b.refreshToken)).status).toBe(200);
  });
});

describe('POST /api/auth/logout', () => {
  it('revokes the session so the refresh token stops working', async () => {
    const first = (await login()).body;
    const out = await request(app)
      .post('/api/auth/logout')
      .send({ refreshToken: first.refreshToken });
    expect(out.status).toBe(204);
    expect((await refresh(first.refreshToken)).status).toBe(401);
  });

  it('is harmless for an unknown token', async () => {
    const out = await request(app)
      .post('/api/auth/logout')
      .send({ refreshToken: 'y'.repeat(64) });
    expect(out.status).toBe(204);
  });
});

describe('role checks', () => {
  const guarded = () => {
    const a = express();
    a.get('/owner-only', requireAuth, requireOwner, (req, res) =>
      res.json({ role: req.auth.role }),
    );
    a.use(errorHandler);
    return a;
  };

  it('lets the owner in', async () => {
    const { token } = signAccessToken({ userId: OWNER_ID, role: 'owner' });
    const res = await request(guarded()).get('/owner-only').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('owner');
  });

  it('blocks staff from owner-only routes', async () => {
    const { token } = signAccessToken({ userId: STAFF_ID, role: 'staff' });
    const res = await request(guarded()).get('/owner-only').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('blocks anonymous requests', async () => {
    const res = await request(guarded()).get('/owner-only');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_REQUIRED');
  });

  it('rejects a token carrying an unknown role', async () => {
    const odd = jwt.sign({ role: 'superuser' }, env.JWT_ACCESS_SECRET, {
      subject: OWNER_ID,
      issuer: ACCESS_ISSUER,
      expiresIn: 60,
    });
    const res = await request(guarded()).get('/owner-only').set('Authorization', `Bearer ${odd}`);
    expect(res.status).toBe(401);
  });
});
