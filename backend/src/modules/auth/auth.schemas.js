import { z } from 'zod';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).regex(EMAIL_RE, 'Enter a valid email address'),
  password: z.string().min(1, 'Password is required').max(200),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(20).max(200),
});