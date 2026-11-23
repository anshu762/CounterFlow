import { create } from 'zustand';
import { rawApi } from './http';
import { queryClient } from './queryClient';
import { refreshTokenStore, REFRESH_KEY } from './storage';
import { describeError } from './errors';

// status: booting (checking stored session) | authed | anon | unreachable (server down at start-up)
export const useSession = create(() => ({
  status: 'booting',
  user: null,
  role: null,
  accessToken: null,
  bootError: null,
  notice: null,
}));

// UI-only convenience. The server never trusts this: it checks the role itself.
export function roleFromToken(token) {
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(part)).role ?? null;
  } catch {
    return null;
  }
}

// A 4xx answer (other than 408/429) means the server looked at the token and said no.
// Network errors, timeouts, 429 and 5xx are transient: keep the session and retry later.
export function isDefinitiveRejection(err) {
  const status = err?.response?.status;
  return status >= 400 && status < 500 && status !== 408 && status !== 429;
}

function applySession(data) {
  refreshTokenStore.set(data.refreshToken);
  const prev = useSession.getState();
  const user = data.user ?? prev.user;
  useSession.setState({
    accessToken: data.accessToken,
    user,
    role: user?.role ?? roleFromToken(data.accessToken),
    status: user ? 'authed' : prev.status,
    bootError: null,
    notice: null,
  });
}

// Only needed if a session response ever arrives without a user object.
async function ensureUser(accessToken) {
  if (useSession.getState().user) return;
  const { data } = await rawApi.get('/api/auth/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const user = data.user ?? data;
  useSession.setState({
    user,
    role: user?.role ?? roleFromToken(accessToken),
    status: 'authed',
  });
}

export function endSession(notice = null) {
  refreshTokenStore.clear();
  useSession.setState({
    status: 'anon',
    user: null,
    role: null,
    accessToken: null,
    bootError: null,
    notice: notice === 'expired' ? 'Your session has ended. Please sign in again.' : null,
  });
  queryClient.clear();
}

// Refresh tokens are single-use. Two refreshes at once (two tabs, or React StrictMode's
// double effect) would look like token theft and revoke the whole session, so refreshes
// are serialised across tabs with the Web Locks API when the browser has it.
function withRefreshLock(fn) {
  const locks = globalThis.navigator?.locks;
  if (!locks?.request) return fn();
  return locks.request('counterflow-refresh', fn);
}

async function runRefresh() {
  return withRefreshLock(async () => {
    const token = refreshTokenStore.get(); // read inside the lock: another tab may have rotated it
    if (!token) {
      endSession();
      throw Object.assign(new Error('No session'), { code: 'NO_SESSION' });
    }
    let data;
    try {
      ({ data } = await rawApi.post('/api/auth/refresh', { refreshToken: token }));
    } catch (err) {
      if (isDefinitiveRejection(err)) endSession('expired');
      throw err;
    }
    applySession(data);
    await ensureUser(data.accessToken);
    return data.accessToken;
  });
}

// Single-flight within this tab: every caller shares one network request.
let inflight = null;
export function refreshSession() {
  if (!inflight) {
    inflight = runRefresh().finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

let listening = false;
function listenForOtherTabs() {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  window.addEventListener('storage', (e) => {
    const relevant = e.key === REFRESH_KEY || e.key === null;
    if (relevant && !refreshTokenStore.get() && useSession.getState().status === 'authed') {
      endSession(); // another tab signed out
    }
  });
}

export async function bootstrap() {
  listenForOtherTabs();
  if (!refreshTokenStore.get()) {
    useSession.setState({ status: 'anon' });
    return;
  }
  useSession.setState({ status: 'booting', bootError: null });
  try {
    await refreshSession();
  } catch (err) {
    if (useSession.getState().status === 'anon') return; // server rejected it: already signed out
    useSession.setState({ status: 'unreachable', bootError: describeError(err).message });
  }
}

export async function login({ email, password }) {
  const { data } = await rawApi.post('/api/auth/login', { email, password });
  applySession(data);
  await ensureUser(data.accessToken);
}

export async function logout() {
  const token = refreshTokenStore.get();
  endSession();
  if (token) {
    try {
      await rawApi.post('/api/auth/logout', { refreshToken: token });
    } catch {
      /* revoking on the server is best-effort; the local session is already gone */
    }
  }
}