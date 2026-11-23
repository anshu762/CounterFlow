import { z } from 'zod';

export const BADGES = [
  ['must_try', 'Must try'],
  ['house_special', 'House special'],
  ['signature', 'Signature'],
  ['speciality', 'Speciality'],
];
export const BADGE_LABEL = Object.fromEntries(BADGES);

function numberField({ label, min, max, integer = false, exclusiveMin = false }) {
  return z
    .string()
    .trim()
    .superRefine((v, ctx) => {
      const fail = (message) => ctx.addIssue({ code: 'custom', message });
      if (v === '') return fail(`Enter ${label}`);
      const pattern = integer ? /^\d+$/ : /^\d+(\.\d{1,2})?$/;
      if (!pattern.test(v)) {
        return fail(integer ? 'Use a whole number' : 'Use a number like 150 or 99.50');
      }
      const n = Number(v);
      if (exclusiveMin ? n <= min : n < min) {
        return fail(exclusiveMin ? `Must be more than ${min}` : `Must be at least ${min}`);
      }
      if (n > max) return fail(`Cannot be more than ${max}`);
      return undefined;
    });
}

const text = (v) => {
  const t = String(v ?? '').trim();
  return t === '' ? null : t;
};
const num = (v) => Number(String(v ?? '').trim());

function diffObjects(next, prev) {
  const changes = {};
  for (const key of Object.keys(next)) {
    if (JSON.stringify(next[key]) !== JSON.stringify(prev[key])) changes[key] = next[key];
  }
  return changes;
}

// ---------- items ----------
export const itemFormSchema = z.object({
  categoryId: z.string().min(1, 'Pick a category'),
  name: z.string().trim().min(1, 'Enter the item name').max(120, 'Keep it under 120 characters'),
  description: z.string().trim().max(500, 'Keep it under 500 characters'),
  price: numberField({ label: 'the price', min: 0, max: 100000, exclusiveMin: true }),
  gstPercent: numberField({ label: 'the GST percentage', min: 0, max: 28 }),
  prepTimeMinutes: numberField({ label: 'the prep time', min: 1, max: 240, integer: true }),
  isVeg: z.enum(['veg', 'nonveg'], { message: 'Choose veg or non-veg' }),
  badge: z.string().refine((v) => v === '' || Object.hasOwn(BADGE_LABEL, v), 'Pick a badge'),
  isAvailable: z.boolean(),
});

export function itemToForm(item, { categoryId = '', defaultGst = 5 } = {}) {
  if (!item) {
    return {
      categoryId,
      name: '',
      description: '',
      price: '',
      gstPercent: String(defaultGst),
      prepTimeMinutes: '10',
      isVeg: 'veg',
      badge: '',
      isAvailable: true,
    };
  }
  return {
    categoryId: item.categoryId,
    name: item.name,
    description: item.description ?? '',
    price: String(item.price),
    gstPercent: String(item.gstPercent),
    prepTimeMinutes: String(item.prepTimeMinutes),
    isVeg: item.isVeg ? 'veg' : 'nonveg',
    badge: item.badge ?? '',
    isAvailable: Boolean(item.isAvailable),
  };
}

export function formToItemPayload(v) {
  return {
    categoryId: v.categoryId,
    name: String(v.name ?? '').trim(),
    description: text(v.description),
    price: num(v.price),
    gstPercent: num(v.gstPercent),
    prepTimeMinutes: num(v.prepTimeMinutes),
    isVeg: v.isVeg === 'veg',
    badge: v.badge || null,
    isAvailable: Boolean(v.isAvailable),
  };
}

// Only the fields that differ from `base`. An empty object means nothing to save.
export function diffItem(values, base) {
  return diffObjects(formToItemPayload(values), formToItemPayload(base));
}

// ---------- categories ----------
export const categoryFormSchema = z.object({
  groupName: z.string().trim().min(1, 'Choose or type a group').max(60, 'Keep it under 60 characters'),
  name: z.string().trim().min(1, 'Enter the category name').max(80, 'Keep it under 80 characters'),
  description: z.string().trim().max(300, 'Keep it under 300 characters'),
  isActive: z.boolean(),
});

export function categoryToForm(category, { groupName = '' } = {}) {
  return {
    groupName: category?.groupName ?? groupName,
    name: category?.name ?? '',
    description: category?.description ?? '',
    isActive: category ? Boolean(category.isActive) : true,
  };
}

export function formToCategoryPayload(v) {
  return {
    groupName: String(v.groupName ?? '').trim(),
    name: String(v.name ?? '').trim(),
    description: text(v.description),
    isActive: Boolean(v.isActive),
  };
}

export function diffCategory(values, base) {
  return diffObjects(formToCategoryPayload(values), formToCategoryPayload(base));
}