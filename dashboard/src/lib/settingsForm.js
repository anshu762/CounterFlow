import { z } from 'zod';
import {
  CUSTOM_KEYS,
  THEMES,
  customColourProblem,
  resolveTheme,
} from '../theme/themes';

export const DAYS = [
  ['mon', 'Monday'],
  ['tue', 'Tuesday'],
  ['wed', 'Wednesday'],
  ['thu', 'Thursday'],
  ['fri', 'Friday'],
  ['sat', 'Saturday'],
  ['sun', 'Sunday'],
];

export const DEFAULT_OPEN = '09:00';
export const DEFAULT_CLOSE = '22:00';

// These mirror the backend rules, so most mistakes are caught before a request is sent.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+0-9\s\-()]{6,20}$/;
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

function numberField({ label, min, max, integer = false }) {
  return z.string().trim().superRefine((v, ctx) => {
    const fail = (message) => ctx.addIssue({ code: 'custom', message });
    if (v === '') return fail(`Enter ${label}`);
    const pattern = integer ? /^\d+$/ : /^\d+(\.\d{1,2})?$/;
    if (!pattern.test(v)) return fail(integer ? 'Use a whole number' : 'Use a number like 5 or 12.5');
    const n = Number(v);
    if (n < min) return fail(`Must be at least ${min}`);
    if (n > max) return fail(`Cannot be more than ${max}`);
    return undefined;
  });
}

const time = z.string().regex(HH_MM, 'Enter a time');
const day = z.object({ open: time, close: time, closed: z.boolean() });

export const settingsFormSchema = z
  .object({
    name: z.string().trim().min(1, 'Enter the café name').max(120, 'Keep it under 120 characters'),
    phone: z.string().trim().refine((v) => v === '' || PHONE_RE.test(v), 'Enter a valid phone number'),
    email: z
      .string()
      .trim()
      .max(254, 'Email is too long')
      .refine((v) => v === '' || EMAIL_RE.test(v), 'Enter a valid email address'),
    address: z.string().trim().max(300, 'Keep it under 300 characters'),
    city: z.string().trim().max(80, 'Keep it under 80 characters'),
    state: z.string().trim().max(80, 'Keep it under 80 characters'),
    gstin: z
      .string()
      .trim()
      .refine((v) => v === '' || GSTIN_RE.test(v.toUpperCase()), 'Enter a valid 15-character GSTIN'),
    logoUrl: z
      .string()
      .trim()
      .max(500, 'Link is too long')
      .refine((v) => v === '' || /^https:\/\//i.test(v), 'Logo must be an https link'),
    defaultGstPercent: numberField({ label: 'the GST percentage', min: 0, max: 28 }),
    pricesIncludeGst: z.boolean(),
    billPrefix: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9]{1,6}$/, 'Use 1 to 6 letters or numbers'),
    avgPrepSlotMinutes: numberField({ label: 'the minutes per order', min: 1, max: 120, integer: true }),
    hours: z.object(Object.fromEntries(DAYS.map(([key]) => [key, day]))),
    themeId: z.string().refine((id) => Object.hasOwn(THEMES, id), 'Pick a theme'),
    customOn: z.boolean(),
    brand: z.string(),
    accent: z.string(),
    paper: z.string(),
  })
  .superRefine((v, ctx) => {
    if (!v.customOn) return;
    for (const key of CUSTOM_KEYS) {
      const problem = customColourProblem(key, v[key]);
      if (problem) ctx.addIssue({ code: 'custom', path: [key], message: problem });
    }
  });

// API settings -> form values (everything is a string or boolean the inputs can show).
export function settingsToForm(s) {
  const t = resolveTheme(s?.theme);
  const hours = {};
  for (const [key] of DAYS) {
    const d = s?.businessHours?.[key];
    hours[key] = {
      open: d?.open ?? DEFAULT_OPEN,
      close: d?.close ?? DEFAULT_CLOSE,
      closed: Boolean(d?.closed),
    };
  }
  return {
    name: s?.name ?? '',
    phone: s?.phone ?? '',
    email: s?.email ?? '',
    address: s?.address ?? '',
    city: s?.city ?? '',
    state: s?.state ?? '',
    gstin: s?.gstin ?? '',
    logoUrl: s?.logoUrl ?? '',
    defaultGstPercent: String(s?.defaultGstPercent ?? 5),
    pricesIncludeGst: Boolean(s?.pricesIncludeGst),
    billPrefix: s?.billPrefix ?? 'BHK',
    avgPrepSlotMinutes: String(s?.avgPrepSlotMinutes ?? 5),
    hours,
    themeId: t.id,
    customOn: t.customised,
    brand: t.brand,
    accent: t.accent,
    paper: t.paper,
  };
}

const text = (v) => {
  const t = String(v ?? '').trim();
  return t === '' ? null : t;
};

// Form values -> the theme object that is saved: { themeId, custom? }
export function themeFromForm(v) {
  const theme = { themeId: v.themeId };
  if (v.customOn) {
    theme.custom = {
      brand: String(v.brand ?? '').toLowerCase(),
      accent: String(v.accent ?? '').toLowerCase(),
      paper: String(v.paper ?? '').toLowerCase(),
    };
  }
  return theme;
}

// Form values -> the full PATCH /api/settings body (accepting orders has its own switch).
export function formToPayload(v) {
  const businessHours = {};
  for (const [key] of DAYS) {
    const d = v.hours?.[key] ?? {};
    businessHours[key] = { open: d.open, close: d.close, closed: Boolean(d.closed) };
  }
  return {
    name: String(v.name ?? '').trim(),
    phone: text(v.phone),
    email: text(v.email)?.toLowerCase() ?? null,
    address: text(v.address),
    city: text(v.city),
    state: text(v.state),
    gstin: text(v.gstin)?.toUpperCase() ?? null,
    logoUrl: text(v.logoUrl),
    defaultGstPercent: Number(String(v.defaultGstPercent ?? '').trim()),
    pricesIncludeGst: Boolean(v.pricesIncludeGst),
    billPrefix: String(v.billPrefix ?? '').trim().toUpperCase(),
    avgPrepSlotMinutes: Number(String(v.avgPrepSlotMinutes ?? '').trim()),
    businessHours,
    theme: themeFromForm(v),
  };
}

// Only the fields that differ from `base`. An empty object means nothing to save.
export function diffPayload(values, base) {
  const next = formToPayload(values);
  const prev = formToPayload(base);
  const changes = {};
  for (const key of Object.keys(next)) {
    if (JSON.stringify(next[key]) !== JSON.stringify(prev[key])) changes[key] = next[key];
  }
  return changes;
}

// The public /api/cafe shape (no email, GSTIN, bill prefix or prep slot).
export function cafeFromSettings(s) {
  return {
    name: s.name,
    phone: s.phone,
    address: s.address,
    city: s.city,
    state: s.state,
    logoUrl: s.logoUrl,
    acceptingOrders: s.acceptingOrders,
    businessHours: s.businessHours,
    theme: s.theme,
    defaultGstPercent: s.defaultGstPercent,
    pricesIncludeGst: s.pricesIncludeGst,
  };
}