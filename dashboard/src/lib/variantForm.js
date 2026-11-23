import { z } from 'zod';

// Same price rules as items: more than 0, at most 2 decimals, at most 100000.
const priceField = z
  .string()
  .trim()
  .superRefine((v, ctx) => {
    const fail = (message) => ctx.addIssue({ code: 'custom', message });
    if (v === '') return fail('Enter the price');
    if (!/^\d+(\.\d{1,2})?$/.test(v)) return fail('Use a number like 150 or 99.50');
    const n = Number(v);
    if (n <= 0) return fail('Must be more than 0');
    if (n > 100000) return fail('Cannot be more than 100000');
    return undefined;
  });

export const variantFormSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, 'Enter a size name, like Small or Large')
    .max(40, 'Keep it under 40 characters'),
  price: priceField,
});

export function variantToForm(variant) {
  return {
    label: variant?.label ?? '',
    price: variant ? String(variant.price) : '',
  };
}

export function formToVariantPayload(v) {
  return {
    label: String(v.label ?? '').trim(),
    price: Number(String(v.price ?? '').trim()),
  };
}

// Only the fields that differ from `base`. An empty object means nothing to save.
export function diffVariant(values, base) {
  const next = formToVariantPayload(values);
  const prev = formToVariantPayload(base);
  const changes = {};
  for (const key of Object.keys(next)) {
    if (next[key] !== prev[key]) changes[key] = next[key];
  }
  return changes;
}
