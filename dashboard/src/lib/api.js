import axios from 'axios';

export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

// 20s timeout: the first request after Neon sleeps can take several seconds.
export const api = axios.create({ baseURL: API_URL, timeout: 20000 });