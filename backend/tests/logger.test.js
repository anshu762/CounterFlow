import { describe, it, expect } from 'vitest';
import pino from 'pino';
import { LOG_REDACTION } from '../src/config/logger.js';

describe('log redaction', () => {
  it('hides the Authorization header and cookies but keeps other headers', () => {
    const lines = [];
    const log = pino({ redact: LOG_REDACTION }, { write: (s) => lines.push(s) });
    log.info(
      {
        req: {
          headers: { authorization: 'Bearer secret-token', cookie: 'a=b', accept: 'json' },
        },
      },
      'request',
    );
    const out = lines.join('');
    expect(out).not.toContain('secret-token');
    expect(out).not.toContain('a=b');
    expect(out).toContain('json');
  });
});
