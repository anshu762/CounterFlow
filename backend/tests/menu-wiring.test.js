import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// Shared state for the mocks below (vi.mock is hoisted above the imports).
const fake = vi.hoisted(() => ({ admin: null, lookups: [] }));

// The "database" auth store that createApp() builds when no authStore is injected.
vi.mock('../src/modules/auth/auth.store.js', () => ({
  createPgAuthStore: () => ({
    findAdminById: async (id) => {
      fake.lookups.push(id);
      return fake.admin;
    },
  }),
}));

// Skip JWT verification only; every other export of auth.js stays real.
vi.mock('../src/middleware/auth.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    requireAuth: (req, _res, next) => {
      req.auth = { userId: 'user-1', role: 'owner' };
      next();
    },
  };
});

import { createApp } from '../src/app.js';

// These routes validate or reject BEFORE touching the menu database,
// so they prove the guard is wired to a real store without needing one.
describe('menu routes are wired to the real admin store (no injection)', () => {
  beforeEach(() => {
    fake.admin = null;
    fake.lookups = [];
  });

  it('lets an active owner through the owner guard (validation runs next)', async () => {
    fake.admin = { user_id: 'user-1', role: 'owner', is_active: true, name: 'Owner' };
    const res = await request(createApp()).post('/api/admin/categories').send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(fake.lookups).toEqual(['user-1']);
  });

  it('refuses staff on an owner-only route with 403', async () => {
    fake.admin = { user_id: 'user-1', role: 'staff', is_active: true, name: 'Staff' };
    const res = await request(createApp()).post('/api/admin/categories').send({});
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('refuses a deactivated or missing account with 401', async () => {
    fake.admin = null;
    const res = await request(createApp()).post('/api/admin/categories').send({});
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_REQUIRED');
  });
});