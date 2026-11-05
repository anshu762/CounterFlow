import { createServer } from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { closeDb } from './config/db.js';

const app = createApp();
// Plain http server so Socket.IO can attach to it in Phase 2.
const server = createServer(app);

server.listen(env.PORT, '0.0.0.0', () => {
  logger.info(`CounterFlow API listening on port ${env.PORT} (${env.NODE_ENV})`);
});

function shutdown(signal) {
  logger.info({ signal }, 'Shutting down');
  server.close(async () => {
    await closeDb();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => logger.error({ reason }, 'Unhandled rejection'));