import axios from 'axios';

export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

// 60s: a sleeping Render free instance (plus a cold Neon database) can take ~1 minute to wake.
export const REQUEST_TIMEOUT_MS = 60000;

// Plain client with NO auth interceptors. It is used for login, refresh and logout,
// so a failed refresh can never trigger another refresh.
export const rawApi = axios.create({ baseURL: API_URL, timeout: REQUEST_TIMEOUT_MS });
