import { describe, it, expect, vi } from 'vitest';
import { sanitizeMetadata, createAuditLog } from '../src/modules/audit/audit.js';

describe('sanitizeMetadata', () => {
  it('redacts anything that looks like a credential, at any depth', () => {
    const out = sanitizeMetadata({
      role: 'staff',
      password: 'x',
      nested: { refreshToken: 'y', ok: 1 },
      list: [{ secret: 's', fine: true }],
    });
    expect(out).toEqual({
      role: 'staff',
      password: '[redacted]',
      nested: { refreshToken: '[redacted]', ok: 1 },
      list: [{ secret: '[redacted]', fine: true }],
    });
  });
});

describe('createAuditLog', () => {
  it('writes one row with the expected values and no secrets', async () => {
    const pool = { query: vi.fn().mockResolvedValue({}) };
    await createAuditLog(pool).record({
      actorId: 'u1',
      action: 'user.create',
      entityType: 'admin_user',
      entityId: 'e1',
      metadata: { password: 'p', role: 'staff' },
      ip: '1.2.3.4',
    });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain('insert into audit_log');
    expect(params).toEqual([
      'admin',
      'u1',
      'user.create',
      'admin_user',
      'e1',
      expect.any(String),
      '1.2.3.4',
    ]);
    expect(JSON.parse(params[5])).toEqual({ password: '[redacted]', role: 'staff' });
  });

  it('never throws when the database fails', async () => {
    const pool = { query: vi.fn().mockRejectedValue(new Error('db down')) };
    await expect(createAuditLog(pool).record({ action: 'x' })).resolves.toBeUndefined();
  });

  it('does nothing without a database', async () => {
    await expect(createAuditLog(null).record({ action: 'x' })).resolves.toBeUndefined();
  });
});
