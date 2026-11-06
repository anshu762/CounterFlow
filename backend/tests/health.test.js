import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

const app = createApp();

describe('GET /health', () => {
  it('returns ok without touching the database', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('counterflow-api');
  });

  it('is also available under /api/health', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
  });
});

describe('error handling', () => {
  it('returns a JSON 404 for unknown routes', async () => {
    const res = await request(app).get('/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 400 for malformed JSON', async () => {
    const res = await request(app)
      .post('/anything')
      .set('Content-Type', 'application/json')
      .send('{bad json');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });

  it('allows any localhost port outside production (Flutter web / Vite)', async () => {
    const res = await request(app).get('/health').set('Origin', 'http://localhost:59639');
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:59639');
  });

  it('still blocks non-local origins that only look similar', async () => {
    const res = await request(app).get('/health').set('Origin', 'http://localhost.evil.com');
    expect(res.status).toBe(403);
  });

  it('blocks disallowed CORS origins', async () => {
    const res = await request(app).get('/health').set('Origin', 'http://evil.example');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CORS_BLOCKED');
  });
});
