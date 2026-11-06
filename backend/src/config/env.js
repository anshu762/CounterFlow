import 'dotenv/config';
import { z } from 'zod';

const emptyToUndefined = (v) => (v === '' ? undefined : v);

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  DATABASE_URL: z.preprocess(emptyToUndefined, z.string().optional()),
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

if (data.NODE_ENV === 'production' && !data.DATABASE_URL) {
  console.error('DATABASE_URL is required in production.');
  process.exit(1);
}

export const env = {
  ...data,
  isProd: data.NODE_ENV === 'production',
  isTest: data.NODE_ENV === 'test',
  corsOrigins: data.CORS_ORIGINS.split(',')
    .map((s) => s.trim())
    .filter(Boolean),
};
