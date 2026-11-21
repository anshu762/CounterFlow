import { AppError } from '../../utils/errors.js';
import { DuplicateCustomerError, DuplicateAdminEmailError, LastOwnerError } from './auth.errors.js';

// All SQL for auth and user accounts lives here so services can be tested with an in-memory store.
export function createPgAuthStore(pool) {
  const db = () => {
    if (!pool) throw new AppError('Database is not configured', 503, 'DB_NOT_CONFIGURED');
    return pool;
  };

  const insertSql = `
    insert into refresh_tokens
      (token_id, family_id, admin_user_id, customer_id, token_hash, expires_at, ip, user_agent)
    values ($1, $2, $3, $4, $5, $6, $7, $8)`;
  const insertParams = (r) => [
    r.tokenId,
    r.familyId,
    r.adminUserId ?? null,
    r.customerId ?? null,
    r.tokenHash,
    r.expiresAt,
    r.ip,
    r.userAgent,
  ];

  const adminCols = 'user_id, name, email, password_hash, role, is_active';
  const adminListCols = 'user_id, name, email, role, is_active, last_login_at';
  const customerCols = 'customer_id, name, phone, email, password_hash, is_active';

  return {
    // ---------- staff accounts ----------
    async findAdminByEmail(email) {
      const { rows } = await db().query(
        `select ${adminCols} from admin_users where lower(email) = lower($1)`,
        [email],
      );
      return rows[0] ?? null;
    },

    async findAdminById(id) {
      const { rows } = await db().query(`select ${adminCols} from admin_users where user_id = $1`, [
        id,
      ]);
      return rows[0] ?? null;
    },

    async touchLastLogin(id) {
      await db().query('update admin_users set last_login_at = now() where user_id = $1', [id]);
    },

    async listAdmins() {
      const { rows } = await db().query(
        `select ${adminListCols} from admin_users order by lower(name), lower(email)`,
      );
      return rows;
    },

    async createAdmin({ name, email, passwordHash, role }) {
      try {
        const { rows } = await db().query(
          `insert into admin_users (name, email, password_hash, role)
           values ($1, $2, $3, $4)
           returning ${adminListCols}`,
          [name, email, passwordHash, role],
        );
        return rows[0];
      } catch (err) {
        if (err.code === '23505') throw new DuplicateAdminEmailError();
        throw err;
      }
    },

    // patch keys: name, email, role, isActive. Returns the updated row, or null if not found.
    // Throws LastOwnerError if the change would leave no active owner.
    async updateAdmin(id, patch) {
      const sets = [];
      const params = [id];
      const add = (column, value) => {
        params.push(value);
        sets.push(`${column} = $${params.length}`);
      };
      if (patch.name !== undefined) add('name', patch.name);
      if (patch.email !== undefined) add('email', patch.email);
      if (patch.role !== undefined) add('role', patch.role);
      if (patch.isActive !== undefined) add('is_active', patch.isActive);

      if (sets.length === 0) {
        const { rows } = await db().query(
          `select ${adminListCols} from admin_users where user_id = $1`,
          [id],
        );
        return rows[0] ?? null;
      }

      const client = await db().connect();
      try {
        await client.query('begin');
        // Lock every active owner so two simultaneous changes cannot both remove the last one.
        await client.query(
          `select user_id from admin_users where role = 'owner' and is_active = true for update`,
        );
        const current = (
          await client.query(
            `select ${adminListCols} from admin_users where user_id = $1 for update`,
            [id],
          )
        ).rows[0];
        if (!current) {
          await client.query('rollback');
          return null;
        }

        const nextRole = patch.role ?? current.role;
        const nextActive = patch.isActive ?? current.is_active;
        const wasActiveOwner = current.role === 'owner' && current.is_active;
        const staysActiveOwner = nextRole === 'owner' && nextActive;
        if (wasActiveOwner && !staysActiveOwner) {
          const { rows } = await client.query(
            `select count(*)::int as n from admin_users
               where role = 'owner' and is_active = true and user_id <> $1`,
            [id],
          );
          if (rows[0].n === 0) throw new LastOwnerError();
        }

        const { rows } = await client.query(
          `update admin_users set ${sets.join(', ')} where user_id = $1 returning ${adminListCols}`,
          params,
        );
        await client.query('commit');
        return rows[0];
      } catch (err) {
        await client.query('rollback').catch(() => {});
        if (err.code === '23505') throw new DuplicateAdminEmailError();
        throw err;
      } finally {
        client.release();
      }
    },

    async setAdminPassword(id, passwordHash) {
      const result = await db().query(
        'update admin_users set password_hash = $2 where user_id = $1',
        [id, passwordHash],
      );
      return result.rowCount > 0;
    },

    async revokeAllForAdmin(id) {
      await db().query(
        `update refresh_tokens set revoked_at = coalesce(revoked_at, now())
           where admin_user_id = $1`,
        [id],
      );
    },

    // ---------- customers ----------
    async findCustomerByPhone(phone) {
      const { rows } = await db().query(`select ${customerCols} from customers where phone = $1`, [
        phone,
      ]);
      return rows[0] ?? null;
    },

    async findCustomerByEmail(email) {
      const { rows } = await db().query(
        `select ${customerCols} from customers where lower(email) = lower($1)`,
        [email],
      );
      return rows[0] ?? null;
    },

    async findCustomerById(id) {
      const { rows } = await db().query(
        `select ${customerCols} from customers where customer_id = $1`,
        [id],
      );
      return rows[0] ?? null;
    },

    async createCustomer({ name, phone, email, passwordHash }) {
      try {
        const { rows } = await db().query(
          `insert into customers (name, phone, email, password_hash)
           values ($1, $2, $3, $4)
           returning ${customerCols}`,
          [name, phone, email ?? null, passwordHash],
        );
        return rows[0];
      } catch (err) {
        if (err.code === '23505') {
          const field = /email/i.test(`${err.constraint ?? ''} ${err.detail ?? ''}`)
            ? 'email'
            : 'phone';
          throw new DuplicateCustomerError(field);
        }
        throw err;
      }
    },

    // ---------- refresh tokens ----------
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
