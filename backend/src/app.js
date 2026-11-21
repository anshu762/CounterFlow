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
import { createCustomerAuthRouter } from './modules/auth/customer-auth.routes.js';
import { createAuthService } from './modules/auth/auth.service.js';
import { createPgAuthStore } from './modules/auth/auth.store.js';
import { createAuditLog } from './modules/audit/audit.js';
import { createSettingsService } from './modules/settings/settings.service.js';
import { createPgSettingsStore } from './modules/settings/settings.store.js';
import {
  createCafePublicRouter,
  createSettingsRouter,
} from './modules/settings/settings.routes.js';
import { createUsersService } from './modules/users/users.service.js';
import { createUsersRouter } from './modules/users/users.routes.js';

// Options exist so tests can inject in-memory stores and relaxed rate limits.
export function createApp({
  authStore,
  settingsStore,
  auditLog,
  loginRateLimit,
  refreshRateLimit,
  signupRateLimit,
} = {}) {
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

  const adminStore = authStore ?? createPgAuthStore(pool);
  const audit = auditLog ?? createAuditLog(pool);
  const authService = createAuthService({ store: adminStore, audit });
  const settingsService = createSettingsService({
    store: settingsStore ?? createPgSettingsStore(pool),
    audit,
  });
  const usersService = createUsersService({ store: adminStore, audit });

  app.use(
    '/api/auth',
    createAuthRouter({ service: authService, loginRateLimit, refreshRateLimit }),
  );
  app.use(
    '/api/customer/auth',
    createCustomerAuthRouter({
      service: authService,
      signupRateLimit,
      loginRateLimit,
      refreshRateLimit,
    }),
  );
  app.use('/api/cafe', createCafePublicRouter({ service: settingsService }));
  app.use('/api/settings', createSettingsRouter({ service: settingsService, adminStore }));
  app.use('/api/users', createUsersRouter({ service: usersService, adminStore }));

  // More feature modules are mounted under /api in later parts.
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
