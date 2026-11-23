import { describe, it, expect } from 'vitest';
import {
  diffVariant,
  formToVariantPayload,
  variantFormSchema,
  variantToForm,
} from '../src/lib/variantForm';

const parse = (v) => variantFormSchema.safeParse(v);
const firstMessage = (v) => parse(v).error?.issues[0]?.message;

describe('variantFormSchema', () => {
  it('accepts a normal size', () => {
    expect(parse({ label: 'Large', price: '190' }).success).toBe(true);
    expect(parse({ label: 'Half plate', price: '99.50' }).success).toBe(true);
  });

  it('rejects a blank or too long name', () => {
    expect(parse({ label: '   ', price: '100' }).success).toBe(false);
    expect(parse({ label: 'x'.repeat(41), price: '100' }).success).toBe(false);
    expect(parse({ label: 'x'.repeat(40), price: '100' }).success).toBe(true);
  });

  it('rejects bad prices with a clear message', () => {
    expect(firstMessage({ label: 'L', price: '' })).toBe('Enter the price');
    expect(firstMessage({ label: 'L', price: '0' })).toBe('Must be more than 0');
    expect(firstMessage({ label: 'L', price: 'abc' })).toMatch(/Use a number/);
    expect(firstMessage({ label: 'L', price: '12.345' })).toMatch(/Use a number/);
    expect(firstMessage({ label: 'L', price: '-5' })).toMatch(/Use a number/);
    expect(firstMessage({ label: 'L', price: '100001' })).toBe('Cannot be more than 100000');
    expect(parse({ label: 'L', price: '100000' }).success).toBe(true);
  });
});

describe('variant form mapping', () => {
  it('starts blank when adding and filled when editing', () => {
    expect(variantToForm(null)).toEqual({ label: '', price: '' });
    expect(variantToForm({ id: 'v1', label: 'Large', price: 190 })).toEqual({ label: 'Large', price: '190' });
  });

  it('builds the payload with a trimmed name and a numeric price', () => {
    expect(formToVariantPayload({ label: '  Large ', price: ' 190.50 ' })).toEqual({
      label: 'Large',
      price: 190.5,
    });
  });
});

describe('diffVariant', () => {
  const base = { label: 'Large', price: '190' };

  it('is empty when only formatting differs', () => {
    expect(diffVariant({ label: ' Large ', price: '190.00' }, base)).toEqual({});
  });

  it('contains only the changed fields', () => {
    expect(diffVariant({ label: 'Large', price: '200' }, base)).toEqual({ price: 200 });
    expect(diffVariant({ label: 'XL', price: '190' }, base)).toEqual({ label: 'XL' });
    expect(diffVariant({ label: 'XL', price: '210' }, base)).toEqual({ label: 'XL', price: 210 });
  });
});