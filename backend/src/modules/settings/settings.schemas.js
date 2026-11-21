import { z } from 'zod';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

const blankToNull = (v) => (typeof v === 'string' && v.trim() === '' ? null : v);
const nullableText = (max) => z.preprocess(blankToNull, z.string().trim().max(max).nullable());

const day = z.strictObject({
  open: z.string().regex(HH_MM, 'Use HH:MM (24 hour)'),
  close: z.string().regex(HH_MM, 'Use HH:MM (24 hour)'),
  closed: z.boolean().optional(),
});

const businessHours = z
  .strictObject({
    mon: day,
    tue: day,
    wed: day,
    thu: day,
    fri: day,
    sat: day,
    sun: day,
  })
  .partial();

const hexColour = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a colour like #2E7D6B');

// Saved as cafe_settings.theme: { themeId, custom }
const theme = z.strictObject({
  themeId: z.string().regex(/^[a-z0-9-]{1,40}$/, 'Invalid theme id'),
  custom: z
    .record(z.string().regex(/^[a-zA-Z]{1,24}$/), hexColour)
    .refine((o) => Object.keys(o).length <= 12, { message: 'Too many custom colours' })
    .nullable()
    .optional(),
});

export const updateSettingsSchema = z
  .strictObject({
    name: z.string().trim().min(1, 'Enter the café name').max(120),
    phone: z.preprocess(
      blankToNull,
      z
        .string()
        .trim()
        .regex(/^[+0-9\s\-()]{6,20}$/, 'Enter a valid phone number')
        .nullable(),
    ),
    email: z.preprocess(
      (v) => (typeof v === 'string' ? (v.trim() === '' ? null : v.trim().toLowerCase()) : v),
      z.string().max(254).regex(EMAIL_RE, 'Enter a valid email address').nullable(),
    ),
    address: nullableText(300),
    city: nullableText(80),
    state: nullableText(80),
    gstin: z.preprocess(
      blankToNull,
      z
        .string()
        .trim()
        .toUpperCase()
        .regex(GSTIN_RE, 'Enter a valid 15-character GSTIN')
        .nullable(),
    ),
    defaultGstPercent: z
      .number()
      .min(0, 'GST cannot be negative')
      .max(28, 'GST cannot be more than 28%')
      .transform((n) => Math.round(n * 100) / 100),
    pricesIncludeGst: z.boolean(),
    avgPrepSlotMinutes: z.number().int().min(1, 'Must be at least 1 minute').max(120),
    acceptingOrders: z.boolean(),
    businessHours,
    logoUrl: z.preprocess(
      blankToNull,
      z
        .string()
        .trim()
        .max(500)
        .refine((v) => /^https:\/\//i.test(v), { message: 'Logo must be an https link' })
        .nullable(),
    ),
    theme,
    billPrefix: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9]{1,6}$/, 'Use 1 to 6 letters or numbers'),
  })
  .partial()
  .refine((o) => Object.values(o).some((v) => v !== undefined), {
    message: 'Send at least one field to change',
  });

export const acceptingOrdersSchema = z.strictObject({ acceptingOrders: z.boolean() });
