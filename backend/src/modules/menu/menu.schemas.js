import { z } from 'zod';

export const BADGES = ['must_try', 'house_special', 'signature', 'speciality'];

const id = z.guid();
export const idParams = z.object({ id });
export const variantParams = z.object({ variantId: id });

const text = (min, max) => z.string().trim().min(min).max(max);
const optionalText = (max) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((v) => (v === '' ? null : v));

const money = z
  .number('Price must be a number')
  .positive('Price must be greater than 0')
  .max(100000)
  .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, 'At most 2 decimal places');
const gst = z.number('GST must be a number').min(0).max(28, 'GST cannot be more than 28%');
const prep = z
  .number('Prep time must be a number')
  .int('Prep time must be whole minutes')
  .min(1, 'Prep time must be at least 1 minute')
  .max(240);

const atLeastOne = (o) => Object.keys(o).length > 0;
const atLeastOneMsg = 'Provide at least one field to change';

// ---- categories ----
const categoryFields = {
  groupName: text(1, 60),
  name: text(1, 80),
  description: optionalText(300),
  isActive: z.boolean(),
};
export const categoryCreate = z
  .object({
    ...categoryFields,
    description: categoryFields.description.optional(),
    isActive: categoryFields.isActive.optional(),
  })
  .strict();
export const categoryUpdate = z
  .object(categoryFields)
  .partial()
  .strict()
  .refine(atLeastOne, atLeastOneMsg);

// ---- items ----
const itemFields = {
  categoryId: id,
  name: text(1, 120),
  description: optionalText(500),
  price: money,
  gstPercent: gst,
  prepTimeMinutes: prep,
  isVeg: z.boolean(),
  isAvailable: z.boolean(),
  badge: z.enum(BADGES).nullable(),
};
export const itemCreate = z
  .object({
    categoryId: itemFields.categoryId,
    name: itemFields.name,
    description: itemFields.description.optional(),
    price: itemFields.price,
    gstPercent: itemFields.gstPercent.default(5),
    prepTimeMinutes: itemFields.prepTimeMinutes.default(10),
    isVeg: itemFields.isVeg,
    isAvailable: itemFields.isAvailable.default(true),
    badge: itemFields.badge.default(null),
  })
  .strict();
export const itemUpdate = z.object(itemFields).partial().strict().refine(atLeastOne, atLeastOneMsg);

// ---- variants (sizes) ----
const variantFields = { label: text(1, 40), price: money, isAvailable: z.boolean() };
export const variantCreate = z
  .object({
    label: variantFields.label,
    price: variantFields.price,
    isAvailable: variantFields.isAvailable.default(true),
  })
  .strict();
export const variantUpdate = z
  .object(variantFields)
  .partial()
  .strict()
  .refine(atLeastOne, atLeastOneMsg);

// ---- misc ----
export const availabilityBody = z.object({ isAvailable: z.boolean() }).strict();
export const reorderBody = z
  .object({ ids: z.array(id).min(1).max(500) })
  .strict()
  .refine((o) => new Set(o.ids).size === o.ids.length, 'ids must be unique');
export const publicMenuQuery = z.object({ veg: z.enum(['true', 'false']).optional() });
