import pino from 'pino';
import { env } from './env.js';

// Never write credentials to logs (pino-http logs request headers).
export const LOG_REDACTION = {
  paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
  censor: '[redacted]',
};

export const logger = pino({
  level: env.isTest ? 'silent' : env.LOG_LEVEL,
  redact: LOG_REDACTION,
  ...(env.isProd || env.isTest
    ? {}
    : { transport: { target: 'pino-pretty', options: { colorize: true } } }),
});
