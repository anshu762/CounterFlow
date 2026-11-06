import pg from 'pg';
import { env } from './env.js';
import { logger } from './logger.js';

const { Pool } = pg;

export const pool = env.DATABASE_URL
  ? new Pool({
      connectionString: env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 15000, // Neon may need a few seconds to wake up
    })
  : null;

if (pool) {
  // Neon closes idle connections; without this handler the process could crash.
  pool.on('error', (err) => logger.warn({ err: err.message }, 'Idle DB client error'));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function pingDb(retries = 2) {
  if (!pool) return { configured: false, ok: false };
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const start = Date.now();
      await pool.query('SELECT 1');
      return { configured: true, ok: true, latencyMs: Date.now() - start };
    } catch (err) {
      logger.warn({ err: err.message, attempt }, 'DB ping failed');
      if (attempt === retries) return { configured: true, ok: false };
      await sleep(1000 * (attempt + 1));
    }
  }
}

export async function closeDb() {
  if (pool) await pool.end();
}
