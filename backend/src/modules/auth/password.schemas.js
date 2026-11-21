import { z } from 'zod';

// Staff passwords: 10-72 characters (bcrypt ignores anything past 72 bytes), a letter and a number.
export const adminPasswordSchema = z
  .string()
  .min(10, 'Use at least 10 characters')
  .max(72, 'Use at most 72 characters')
  .regex(/[A-Za-z]/, 'Include at least one letter')
  .regex(/\d/, 'Include at least one number');

export const changePasswordSchema = z
  .strictObject({
    currentPassword: z.string().min(1, 'Enter your current password').max(200),
    newPassword: adminPasswordSchema,
  })
  .refine((v) => v.currentPassword !== v.newPassword, {
    message: 'The new password must be different',
    path: ['newPassword'],
  });
