import axios from 'axios';

export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

// 60s: a sleeping Render free instance (plus a cold Neon database) can take ~1 minute to wake.
export const api = axios.create({ baseURL: API_URL, timeout: 60000 });