import axios from 'axios';
import { API_URL, REQUEST_TIMEOUT_MS } from './http';
import { useSession, refreshSession, endSession } from './session';

// Re-exported so existing imports (`import { API_URL } from '../lib/api'`) keep working.
export { API_URL };

export const api = axios.create({ baseURL: API_URL, timeout: REQUEST_TIMEOUT_MS });

// Only these 401 codes mean "your access token is no good, try refreshing".
// Anything else (e.g. a wrong current password) must NOT trigger a refresh.
const REFRESHABLE = new Set(['TOKEN_EXPIRED', 'AUTH_REQUIRED', 'INVALID_TOKEN']);

api.interceptors.request.use((config) => {
  const token = useSession.getState().accessToken;
  if (token && !config.headers.get('Authorization')) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { response, config } = error ?? {};
    const code = response?.data?.error?.code;
    if (!response || !config || response.status !== 401 || !REFRESHABLE.has(code)) throw error;

    // This request already carried a freshly refreshed token and was still refused:
    // the account is no longer valid, so end the session.
    if (config._retried) {
      endSession('expired');
      throw error;
    }

    const sent = config.headers?.get?.('Authorization');
    if (!sent) throw error; // anonymous request, nothing to refresh

    config._retried = true;

    // Another request may already have refreshed while this one was in flight.
    const current = useSession.getState().accessToken;
    let token = current && sent !== `Bearer ${current}` ? current : null;
    try {
      token = token ?? (await refreshSession());
    } catch {
      throw error; // refreshSession already ended the session if the server rejected it
    }
    config.headers.set('Authorization', `Bearer ${token}`);
    return api(config);
  },
);