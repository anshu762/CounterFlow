import pg from 'pg';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

// Creates the owner account from environment variables. The password is never in code.
//   npm run seed:owner                      -> create if missing, otherwise do nothing
//   npm run seed:owner -- --reset-password  -> also reset password/role/active for that email
const schema = z.object({
  OWNER_NAME: z.string().trim().min(1).max(120).default('Admin'),
  OWNER_EMAIL: z
    .string()
    .trim()
    .toLowerCase()
    .max(254)
    .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'must be a valid email'),
  OWNER_PASSWORD: z.string().min(10, 'must be at least 10 characters').max(200),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Cannot seed the owner. Fix these variables in backend/.env:');
  for (const issue of parsed.error.issues) {
    console.error(` - ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}
const { OWNER_NAME, OWNER_EMAIL, OWNER_PASSWORD } = parsed.data;

const url = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL_DIRECT (or DATABASE_URL) is not set.');
  process.exit(1);
}

const resetPassword = process.argv.includes('--reset-password');
const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 20000 });

try {
  await client.connect();
  const existing = await client.query(
    'select user_id from admin_users where lower(email) = lower($1)',
    [OWNER_EMAIL],
  );

  if (existing.rowCount === 0) {
    const hash = await bcrypt.hash(OWNER_PASSWORD, 12);
    await client.query(
      `insert into admin_users (name, email, password_hash, role) values ($1, $2, $3, 'owner')`,
      [OWNER_NAME, OWNER_EMAIL, hash],
    );
    console.log(`Owner created: ${OWNER_EMAIL} (role owner).`);
  } else if (resetPassword) {
    const userId = existing.rows[0].user_id;
    const hash = await bcrypt.hash(OWNER_PASSWORD, 12);
    await client.query(
      `update admin_users set password_hash = $2, name = $3, role = 'owner', is_active = true
         where user_id = $1`,
      [userId, hash, OWNER_NAME],
    );
    await client.query(
      `update refresh_tokens set revoked_at = coalesce(revoked_at, now()) where admin_user_id = $1`,
      [userId],
    );
    console.log(`Owner ${OWNER_EMAIL} updated: password reset, all sessions signed out.`);
  } else {
    console.log(`Owner ${OWNER_EMAIL} already exists. Nothing changed (use --reset-password).`);
  }
} catch (err) {
  console.error('Seeding failed:', err.message);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
