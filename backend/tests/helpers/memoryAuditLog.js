import { sanitizeMetadata } from '../../src/modules/audit/audit.js';

export function createMemoryAuditLog() {
  const entries = [];
  return {
    entries,
    async record(e) {
      entries.push({
        actorType: e.actorType ?? 'admin',
        actorId: e.actorId ?? null,
        action: e.action,
        entityType: e.entityType ?? null,
        entityId: e.entityId ?? null,
        metadata: sanitizeMetadata(e.metadata ?? {}),
      });
    },
  };
}
