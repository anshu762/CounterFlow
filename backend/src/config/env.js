import 'dotenv/config';
import { z } from 'zod';

const emptyToUndefined = (v) => (v === '' ? undefined : v);

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  DATABASE_URL: z.preprocess(emptyToUndefined, z.string().optional()),
  JWT_ACCESS_SECRET: z.preprocess(
    emptyToUndefined,
    z.string().min(32, 'must be at least 32 characters').optional(),
  ),
  ACCESS_TOKEN_TTL: z
    .string()
    .regex(/^\d+[smhd]$/, 'use a value like 15m, 1h or 7d')
    .default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  BCRYPT_ROUNDS: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().min(4).max(15).optional(),
  ),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment variables:');
  for (const issue of parsed.error.issues) {
    console.error(` - ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

const data = parsed.data;
const isTestRun = data.NODE_ENV === 'test' || Boolean(process.env.VITEST);

if (data.NODE_ENV === 'production' && !data.DATABASE_URL) {
  console.error('DATABASE_URL is required in production.');
  process.exit(1);
}

let jwtSecret = data.JWT_ACCESS_SECRET;
if (!jwtSecret) {
  if (isTestRun) {
    jwtSecret = 'test-only-secret-never-used-outside-tests-0123456789';
  } else {
    console.error('JWT_ACCESS_SECRET is required (at least 32 characters). Generate one with:');
    console.error(`  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`);
    process.exit(1);
  }
}

export const env = {
  ...data,
  JWT_ACCESS_SECRET: jwtSecret,
  isProd: data.NODE_ENV === 'production',
  isTest: data.NODE_ENV === 'test',
  // Tests use cheap hashing so they stay fast; real runs use 12 rounds.
  bcryptRounds: data.BCRYPT_ROUNDS ?? (isTestRun ? 4 : 12),
  corsOrigins: data.CORS_ORIGINS.split(',')
    .map((s) => s.trim())
    .filter(Boolean),
};