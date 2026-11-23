import { describe, it, expect, beforeEach } from 'vitest';
import { AxiosError } from 'axios';
import { api } from '../src/lib/api';
import { rawApi } from '../src/lib/http';
import { login, logout, roleFromToken, useSession } from '../src/lib/session';
import { refreshTokenStore } from '../src/lib/storage';

const errorBody = (code) => ({ error: { code, message: code } });

function reply(config, status, data) {
  const response = { data, status, statusText: String(status), headers: {}, config, request: {} };
  if (status < 400) return Promise.resolve(response);
  const code = status >= 500 ? 'ERR_BAD_RESPONSE' : 'ERR_BAD_REQUEST';
  return Promise.reject(new AxiosError(`HTTP ${status}`, code, config, {}, response));
}

const USER = { id: 'u1', name: 'Owner', email: 'o@example.com', role: 'owner' };
let s;

function installServer() {
  s = { refreshCalls: 0, refreshMode: 'ok', protectedHits: 0, logoutBody: null };

  api.defaults.adapter = (config) => {
    if (config.url === '/api/protected') {
      s.protectedHits += 1;
      const ok = config.headers.get('Authorization') === 'Bearer fresh';
      return ok ? reply(config, 200, { ok: true }) : reply(config, 401, errorBody('TOKEN_EXPIRED'));
    }
    if (config.url === '/api/password') {
      return reply(config, 401, errorBody('INVALID_CURRENT_PASSWORD'));
    }
    return reply(config, 200, {});
  };

  rawApi.defaults.adapter = (config) => {
    const body = config.data ? JSON.parse(config.data) : {};
    if (config.url === '/api/auth/refresh') {
      s.refreshCalls += 1;
      if (s.refreshMode === 'reused') return reply(config, 401, errorBody('REFRESH_REUSED'));
      if (s.refreshMode === 'down') return reply(config, 503, errorBody('UNAVAILABLE'));
      return reply(config, 200, {
        accessToken: 'fresh',
        refreshToken: `r-${s.refreshCalls + 1}`,
        user: USER,
      });
    }
    if (config.url === '/api/auth/login') {
      if (body.password !== 'right-password') {
        return reply(config, 401, errorBody('INVALID_CREDENTIALS'));
      }
      return reply(config, 200, { accessToken: 'fresh', refreshToken: 'r-login', user: USER });
    }
    if (config.url === '/api/auth/logout') {
      s.logoutBody = body;
      return reply(config, 204, null);
    }
    return reply(config, 404, errorBody('NOT_FOUND'));
  };
}

beforeEach(() => {
  installServer();
  refreshTokenStore.set('r-1');
  useSession.setState({
    status: 'authed',
    user: USER,
    role: 'owner',
    accessToken: 'stale',
    bootError: null,
    notice: null,
  });
});

describe('automatic token refresh', () => {
  it('refreshes once on an expired token and retries the request', async () => {
    const res = await api.get('/api/protected');
    expect(res.data).toEqual({ ok: true });
    expect(s.refreshCalls).toBe(1);
    expect(useSession.getState().accessToken).toBe('fresh');
    expect(refreshTokenStore.get()).toBe('r-2'); // rotated token is stored
  });

  it('shares ONE refresh between parallel requests', async () => {
    const results = await Promise.all([
      api.get('/api/protected'),
      api.get('/api/protected'),
      api.get('/api/protected'),
    ]);
    expect(results.every((r) => r.data.ok)).toBe(true);
    expect(s.refreshCalls).toBe(1);
  });

  it('signs out when the server rejects the refresh token (reuse)', async () => {
    s.refreshMode = 'reused';
    await expect(api.get('/api/protected')).rejects.toMatchObject({ response: { status: 401 } });
    const state = useSession.getState();
    expect(state.status).toBe('anon');
    expect(state.accessToken).toBeNull();
    expect(state.notice).toMatch(/sign in again/i);
    expect(refreshTokenStore.get()).toBeNull();
  });

  it('keeps the session when the server is merely down', async () => {
    s.refreshMode = 'down';
    await expect(api.get('/api/protected')).rejects.toMatchObject({ response: { status: 401 } });
    expect(useSession.getState().status).toBe('authed');
    expect(refreshTokenStore.get()).toBe('r-1');
  });

  it('does not refresh for other 401 codes such as a wrong current password', async () => {
    await expect(api.post('/api/password', {})).rejects.toMatchObject({
      response: { data: { error: { code: 'INVALID_CURRENT_PASSWORD' } } },
    });
    expect(s.refreshCalls).toBe(0);
  });

  it('does not refresh requests that were sent without a token', async () => {
    useSession.setState({ accessToken: null });
    await expect(api.get('/api/protected')).rejects.toBeTruthy();
    expect(s.refreshCalls).toBe(0);
  });
});

describe('login and logout', () => {
  it('login stores the session', async () => {
    useSession.setState({ status: 'anon', user: null, role: null, accessToken: null });
    refreshTokenStore.clear();
    await login({ email: 'o@example.com', password: 'right-password' });
    const state = useSession.getState();
    expect(state.status).toBe('authed');
    expect(state.role).toBe('owner');
    expect(refreshTokenStore.get()).toBe('r-login');
  });

  it('a failed login changes nothing', async () => {
    useSession.setState({ status: 'anon', user: null, role: null, accessToken: null });
    refreshTokenStore.clear();
    await expect(login({ email: 'o@example.com', password: 'nope' })).rejects.toMatchObject({
      response: { status: 401 },
    });
    expect(useSession.getState().status).toBe('anon');
    expect(refreshTokenStore.get()).toBeNull();
  });

  it('logout clears the session first and revokes the token on the server', async () => {
    await logout();
    expect(useSession.getState().status).toBe('anon');
    expect(refreshTokenStore.get()).toBeNull();
    expect(s.logoutBody).toEqual({ refreshToken: 'r-1' });
  });
});

describe('roleFromToken', () => {
  it('reads the role claim', () => {
    const payload = btoa(JSON.stringify({ role: 'staff', sub: 'x' }));
    expect(roleFromToken(`header.${payload}.sig`)).toBe('staff');
  });
  it('returns null for garbage', () => {
    expect(roleFromToken('nope')).toBeNull();
    expect(roleFromToken(null)).toBeNull();
  });
});