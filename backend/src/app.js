import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { AppError } from './utils/errors.js';
import { notFound, errorHandler } from './middleware/error.js';
import healthRouter from './modules/health/health.routes.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1); // Render sits behind a proxy (needed for rate limiting later)
  app.use(helmet());
  app.use(
    cors({
      origin(origin, cb) {
        // No origin = curl/Postman/mobile app; allowed.
        if (!origin || env.corsOrigins.includes(origin)) return cb(null, true);
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
  // Feature modules are mounted under /api in later phases.

  app.use(notFound);
  app.use(errorHandler);
  return app;
}