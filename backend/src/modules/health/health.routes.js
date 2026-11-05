import { Router } from 'express';
import { readFileSync } from 'node:fs';
import { env } from '../../config/env.js';
import { pingDb } from '../../config/db.js';

const pkg = JSON.parse(readFileSync(new URL('../../../package.json', import.meta.url), 'utf8'));
const router = Router();

// Liveness: cheap, never touches the DB (Render uses this one).
router.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'counterflow-api',
    version: pkg.version,
    environment: env.NODE_ENV,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// Readiness: checks the database.
router.get('/db', async (_req, res) => {
  const database = await pingDb();
  res.status(database.ok ? 200 : 503).json({
    status: database.ok ? 'ok' : 'degraded',
    database,
  });
});

export default router;