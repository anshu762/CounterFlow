import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { pool } from './config/db.js';
import { AppError } from './utils/errors.js';
import { notFound, errorHandler } from './middleware/error.js';
import healthRouter from './modules/health/health.routes.js';
import { createAuthRouter } from './modules/auth/auth.routes.js';
import { createPgAuthStore } from './modules/auth/auth.store.js';

// Options exist so tests can inject an in-memory store and relaxed rate limits.
export function createApp({ authStore, loginRateLimit, refreshRateLimit } = {}) {
  const app = express();

  // Development convenience: Vite, Flutter web etc. use varying localhost ports.
  const LOCAL_DEV_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

  app.set('trust proxy', 1); // Render sits behind a proxy (needed for rate limiting)

  app.use(helmet());
  app.use(
    cors({
      origin(origin, cb) {
        // No origin = curl/Postman/mobile app; allowed.
        if (!origin) return cb(null, true);
        if (env.corsOrigins.includes(origin)) return cb(null, true);
        if (!env.isProd && LOCAL_DEV_ORIGIN.test(origin)) return cb(null, true);
        return cb(new AppError('Origin not allowed', 403, 'CORS_BLOCKED'));
      },
      credentials: true,
    }),
  );
  app.use(
    pinoHttp({
      logger,
      autoLogging: { ignore: (req) => req.url === '/health' },
    }),
  );
  app.use(express.json({ limit: '1mb' }));

  app.use('/health', healthRouter);
  app.use('/api/health', healthRouter);

  app.use(
    '/api/auth',
    createAuthRouter({
      store: authStore ?? createPgAuthStore(pool),
      loginRateLimit,
      refreshRateLimit,
    }),
  );

  // More feature modules are mounted under /api in later parts.
  app.use(notFound);
  app.use(errorHandler);
  return app;
}