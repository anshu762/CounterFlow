import { logger } from '../../config/logger.js';

const SENSITIVE_KEY = /pass|token|secret|hash|authorization/i;

// Removes anything that looks like a credential before it is written to the audit log.
export function sanitizeMetadata(value, depth = 0) {
  if (Array.isArray(value)) {
    return depth > 4 ? [] : value.map((v) => sanitizeMetadata(v, depth + 1));
  }
  if (value && typeof value === 'object') {
    if (depth > 4) return {};
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [
        k,
        SENSITIVE_KEY.test(k) ? '[redacted]' : sanitizeMetadata(v, depth + 1),
      ]),
    );
  }
  return value;
}

// Best-effort: an audit failure is logged but never breaks the request that caused it.
export function createAuditLog(pool) {
  return {
    async record({
      actorType = 'admin',
      actorId = null,
      action,
      entityType = null,
      entityId = null,
      metadata = {},
      ip = null,
    }) {
      try {
        if (!pool) return;
        await pool.query(
          `insert into audit_log (actor_type, actor_id, action, entity_type, entity_id, metadata, ip)
           values ($1, $2, $3, $4, $5, $6::jsonb, $7)`,
          [
            actorType,
            actorId,
            action,
            entityType,
            entityId,
            JSON.stringify(sanitizeMetadata(metadata)),
            ip,
          ],
        );
      } catch (err) {
        logger.warn({ err: err.message, action }, 'Audit log write failed');
      }
    },
  };
}
