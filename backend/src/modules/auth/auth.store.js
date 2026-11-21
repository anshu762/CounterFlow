import { AppError } from '../../utils/errors.js';

// All SQL for auth lives here so the service can be tested with an in-memory store.
export function createPgAuthStore(pool) {
  const db = () => {
    if (!pool) throw new AppError('Database is not configured', 503, 'DB_NOT_CONFIGURED');
    return pool;
  };

  const insertSql = `
    insert into refresh_tokens
      (token_id, family_id, admin_user_id, token_hash, expires_at, ip, user_agent)
    values ($1, $2, $3, $4, $5, $6, $7)`;
  const insertParams = (r) => [
    r.tokenId,
    r.familyId,
    r.adminUserId,
    r.tokenHash,
    r.expiresAt,
    r.ip,
    r.userAgent,
  ];

  return {
    async findAdminByEmail(email) {
      const { rows } = await db().query(
        `select user_id, name, email, password_hash, role, is_active
           from admin_users where lower(email) = lower($1)`,
        [email],
      );
      return rows[0] ?? null;
    },

    async findAdminById(id) {
      const { rows } = await db().query(
        `select user_id, name, email, password_hash, role, is_active
           from admin_users where user_id = $1`,
        [id],
      );
      return rows[0] ?? null;
    },

    async touchLastLogin(id) {
      await db().query('update admin_users set last_login_at = now() where user_id = $1', [id]);
    },

    async insertRefreshToken(record) {
      await db().query(insertSql, insertParams(record));
    },

    async findRefreshToken(tokenHash) {
      const { rows } = await db().query(
        `select token_id, family_id, admin_user_id, customer_id, expires_at, revoked_at, replaced_by
           from refresh_tokens where token_hash = $1`,
        [tokenHash],
      );
      return rows[0] ?? null;
    },

    // Atomically retire the old token and store the new one.
    // Returns false if someone else already used the old token (race or replay).
    async rotateRefreshToken(oldTokenId, next) {
      const client = await db().connect();
      try {
        await client.query('begin');
        const claimed = await client.query(
          `update refresh_tokens set revoked_at = now()
             where token_id = $1 and revoked_at is null returning token_id`,
          [oldTokenId],
        );
        if (claimed.rowCount === 0) {
          await client.query('rollback');
          return false;
        }
        await client.query(insertSql, insertParams(next));
        await client.query('update refresh_tokens set replaced_by = $2 where token_id = $1', [
          oldTokenId,
          next.tokenId,
        ]);
        await client.query('commit');
        return true;
      } catch (err) {
        await client.query('rollback').catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    },

    async revokeFamily(familyId) {
      await db().query(
        `update refresh_tokens set revoked_at = coalesce(revoked_at, now())
           where family_id = $1`,
        [familyId],
      );
    },

    async purgeExpired() {
      await db().query(`delete from refresh_tokens where expires_at < now() - interval '7 days'`);
    },
  };
}