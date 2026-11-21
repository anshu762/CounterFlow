import { z } from 'zod';
import { normalizePhone } from '../../utils/phone.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).regex(EMAIL_RE, 'Enter a valid email address'),
  password: z.string().min(1, 'Password is required').max(200),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(20).max(200),
});

const phone = z
  .string()
  .trim()
  .max(25)
  .transform((v) => normalizePhone(v))
  .refine((v) => v !== null, { message: 'Enter a valid phone number' });

const optionalEmail = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  z
    .string()
    .trim()
    .toLowerCase()
    .max(254)
    .regex(EMAIL_RE, 'Enter a valid email address')
    .optional(),
);

export const customerSignupSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name').max(80),
  phone,
  email: optionalEmail,
  password: z
    .string()
    .min(8, 'Use at least 8 characters')
    .max(72, 'Use at most 72 characters')
    .regex(/[A-Za-z]/, 'Include at least one letter')
    .regex(/\d/, 'Include at least one number'),
});

// "identifier" is a phone number or an email address.
export const customerLoginSchema = z.object({
  identifier: z
    .string()
    .trim()
    .max(254)
    .transform((v) => {
      if (v.includes('@')) {
        const email = v.toLowerCase();
        return EMAIL_RE.test(email) ? email : null;
      }
      return normalizePhone(v);
    })
    .refine((v) => v !== null, { message: 'Enter your phone number or email' }),
  password: z.string().min(1, 'Password is required').max(200),
});
