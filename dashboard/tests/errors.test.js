import { describe, it, expect } from 'vitest';
import { AxiosError } from 'axios';
import { describeError } from '../src/lib/errors';

describe('describeError', () => {
  it('reads the API error shape', () => {
    const err = new AxiosError('x', 'ERR_BAD_REQUEST', {}, {}, {
      status: 429,
      data: { error: { code: 'RATE_LIMITED', message: 'Too many attempts' } },
    });
    expect(describeError(err)).toMatchObject({
      status: 429,
      code: 'RATE_LIMITED',
      message: 'Too many attempts',
    });
  });

  it('gives a friendly message for server errors without a body', () => {
    const err = new AxiosError('x', 'ERR_BAD_RESPONSE', {}, {}, { status: 502, data: '' });
    expect(describeError(err).message).toMatch(/try again/i);
  });

  it('recognises a timeout', () => {
    expect(describeError({ code: 'ECONNABORTED' }).code).toBe('TIMEOUT');
  });

  it('recognises a network failure', () => {
    expect(describeError({ code: 'ERR_NETWORK', request: {} }).code).toBe('NETWORK');
  });
});