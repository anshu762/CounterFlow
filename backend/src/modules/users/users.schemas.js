import { z } from 'zod';
import { adminPasswordSchema } from '../auth/password.schemas.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const name = z.string().trim().min(2, 'Enter a name').max(80);
const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .regex(EMAIL_RE, 'Enter a valid email address');
const role = z.enum(['owner', 'staff']);

export const idParamsSchema = z.object({
  id: z.string().regex(UUID_RE, 'Invalid id'),
});

export const createUserSchema = z.strictObject({
  name,
  email,
  role: role.default('staff'),
  password: adminPasswordSchema,
});

export const updateUserSchema = z
  .strictObject({ name, email, role, isActive: z.boolean() })
  .partial()
  .refine((o) => Object.values(o).some((v) => v !== undefined), {
    message: 'Send at least one field to change',
  });

export const resetPasswordSchema = z.strictObject({ newPassword: adminPasswordSchema });
