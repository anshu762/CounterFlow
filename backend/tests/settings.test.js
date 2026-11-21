import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { signAccessToken } from '../src/modules/auth/tokens.js';
import { createPgSettingsStore } from '../src/modules/settings/settings.store.js';
import { createMemoryAuthStore } from './helpers/memoryAuthStore.js';
import { createMemoryAuditLog } from './helpers/memoryAuditLog.js';
import { createMemorySettingsStore } from './helpers/memorySettingsStore.js';

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const STAFF_ID = '22222222-2222-4222-8222-222222222222';
const GUEST_ID = '44444444-4444-4444-8444-444444444444';

const admin = (id, email, role) => ({
  user_id: id,
  name: `${role} user`,
  email,
  password_hash: 'x',
  role,
  is_active: true,
  last_login_at: null,
});
const auth = (id, role) => ({
  Authorization: `Bearer ${signAccessToken({ userId: id, role }).token}`,
});

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
  });
});

const patch = (body, headers = auth(OWNER_ID, 'owner')) =>
  request(app).patch('/api/settings').set(headers).send(body);

describe('GET /api/cafe (public)', () => {
  it('works without signing in and hides private fields', async () => {
    const res = await request(app).get('/api/cafe');
    expect(res.status).toBe(200);
    expect(res.body.cafe.name).toBe('Brick House Kitchen');
    expect(res.body.cafe.acceptingOrders).toBe(true);
    for (const hidden of ['gstin', 'email', 'billPrefix', 'avgPrepSlotMinutes']) {
      expect(res.body.cafe).not.toHaveProperty(hidden);
    }
    expect(res.headers['cache-control']).toContain('max-age');
  });

  it('shows the new value after the café closes orders', async () => {
    await request(app)
      .patch('/api/settings/accepting-orders')
      .set(auth(STAFF_ID, 'staff'))
      .send({ acceptingOrders: false });
    const res = await request(app).get('/api/cafe');
    expect(res.body.cafe.acceptingOrders).toBe(false);
  });
});

describe('GET /api/settings', () => {
  it('requires sign-in', async () => {
    expect((await request(app).get('/api/settings')).status).toBe(401);
  });

  it('is open to owner and staff, with the full settings', async () => {
    for (const [id, role] of [
      [OWNER_ID, 'owner'],
      [STAFF_ID, 'staff'],
    ]) {
      const res = await request(app).get('/api/settings').set(auth(id, role));
      expect(res.status).toBe(200);
      expect(res.body.settings.billPrefix).toBe('BHK');
      expect(res.body.settings).toHaveProperty('gstin');
    }
  });

  it('refuses a customer token', async () => {
    const res = await request(app).get('/api/settings').set(auth(GUEST_ID, 'customer'));
    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/settings', () => {
  it('lets the owner change settings, normalising values', async () => {
    const res = await patch({
      name: ' Brick House Kitchen & Bakery ',
      defaultGstPercent: 12,
      avgPrepSlotMinutes: 7,
      billPrefix: 'bhk',
      gstin: ' 03aabcu9603r1zx ',
      businessHours: {
        mon: { open: '09:00', close: '23:30' },
        sun: { open: '10:00', close: '23:00', closed: true },
      },
      theme: { themeId: 'teal', custom: { brand: '#2E7D6B' } },
    });
    expect(res.status).toBe(200);
    expect(res.body.settings).toMatchObject({
      name: 'Brick House Kitchen & Bakery',
      defaultGstPercent: 12,
      avgPrepSlotMinutes: 7,
      billPrefix: 'BHK',
      gstin: '03AABCU9603R1ZX',
    });
    const again = await request(app).get('/api/settings').set(auth(OWNER_ID, 'owner'));
    expect(again.body.settings.avgPrepSlotMinutes).toBe(7);
  });

  it('turns blank optional text into null', async () => {
    const res = await patch({ gstin: '', phone: '  ', email: '' });
    expect(res.status).toBe(200);
    expect(res.body.settings).toMatchObject({ gstin: null, phone: null, email: null });
  });

  it('is owner-only: staff, customers and anonymous are refused', async () => {
    expect((await patch({ name: 'X' }, auth(STAFF_ID, 'staff'))).status).toBe(403);
    expect((await patch({ name: 'X' }, auth(GUEST_ID, 'customer'))).status).toBe(403);
    expect((await patch({ name: 'X' }, {})).status).toBe(401);
  });

  it('checks the database, so a demoted owner with an old token is refused', async () => {
    store._admins.get(OWNER_ID).role = 'staff';
    expect((await patch({ name: 'X' })).status).toBe(403);
  });

  it('refuses a deactivated owner with an old token', async () => {
    store._admins.get(OWNER_ID).is_active = false;
    expect((await patch({ name: 'X' })).status).toBe(401);
  });

  it.each([
    ['GST above 28', { defaultGstPercent: 29 }],
    ['negative GST', { defaultGstPercent: -1 }],
    ['prep slot zero', { avgPrepSlotMinutes: 0 }],
    ['prep slot with decimals', { avgPrepSlotMinutes: 2.5 }],
    ['invalid GSTIN', { gstin: '123' }],
    ['bill prefix too long', { billPrefix: 'TOOLONGX' }],
    ['bill prefix with symbols', { billPrefix: 'B-K' }],
    ['empty name', { name: '' }],
    ['invalid email', { email: 'nope' }],
    ['logo over http', { logoUrl: 'http://example.com/a.png' }],
    ['invalid opening time', { businessHours: { mon: { open: '25:00', close: '10:00' } } }],
    ['invalid theme colour', { theme: { themeId: 'teal', custom: { brand: 'red' } } }],
    ['unknown field', { hacker: true }],
    ['empty body', {}],
  ])('rejects invalid input: %s', async (_label, body) => {
    const res = await patch(body);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('writes an audit entry with the changed field names only', async () => {
    await patch({ name: 'New Name', gstin: '03AABCU9603R1ZX' });
    expect(audit.entries).toHaveLength(1);
    expect(audit.entries[0]).toMatchObject({
      actorId: OWNER_ID,
      action: 'settings.update',
      entityType: 'cafe_settings',
      metadata: { fields: ['name', 'gstin'] },
    });
  });
});

describe('PATCH /api/settings/accepting-orders', () => {
  const toggle = (body, headers) =>
    request(app).patch('/api/settings/accepting-orders').set(headers).send(body);

  it('lets staff and owner switch it', async () => {
    expect((await toggle({ acceptingOrders: false }, auth(STAFF_ID, 'staff'))).status).toBe(200);
    const res = await toggle({ acceptingOrders: true }, auth(OWNER_ID, 'owner'));
    expect(res.body.settings.acceptingOrders).toBe(true);
    expect(audit.entries.map((e) => e.action)).toEqual([
      'settings.accepting_orders',
      'settings.accepting_orders',
    ]);
  });

  it('refuses customers and anonymous requests', async () => {
    expect((await toggle({ acceptingOrders: false }, auth(GUEST_ID, 'customer'))).status).toBe(403);
    expect((await toggle({ acceptingOrders: false }, {})).status).toBe(401);
  });

  it('requires a real boolean', async () => {
    const res = await toggle({ acceptingOrders: 'no' }, auth(STAFF_ID, 'staff'));
    expect(res.status).toBe(400);
  });
});

describe('Postgres settings store', () => {
  it('builds the update query with column names, jsonb casts and numeric parsing', async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [{ name: 'X', default_gst_percent: '5.00', avg_prep_slot_minutes: 6 }],
    });
    const result = await createPgSettingsStore({ query }).update({
      avgPrepSlotMinutes: 6,
      theme: { themeId: 'teal' },
      ignored: 1,
    });
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('avg_prep_slot_minutes = $1');
    expect(sql).toContain('theme = $2::jsonb');
    expect(sql).toContain('where id = true');
    expect(params).toEqual([6, JSON.stringify({ themeId: 'teal' })]);
    expect(result.defaultGstPercent).toBe(5);
    expect(result.avgPrepSlotMinutes).toBe(6);
  });
});
