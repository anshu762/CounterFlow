import { describe, it, expect } from 'vitest';
import {
  categoryFormSchema,
  categoryToForm,
  diffCategory,
  diffItem,
  formToCategoryPayload,
  formToItemPayload,
  itemFormSchema,
  itemToForm,
} from '../src/lib/menuForm';

const item = {
  id: 'i1',
  categoryId: 'c1',
  name: 'Americano',
  description: 'True American black coffee',
  price: 145,
  gstPercent: 5,
  prepTimeMinutes: 6,
  isVeg: true,
  badge: null,
  isAvailable: true,
};

const form = () => itemToForm(item);
const errorPaths = (changes) => {
  const r = itemFormSchema.safeParse({ ...form(), ...changes });
  return r.success ? [] : r.error.issues.map((i) => i.path.join('.'));
};

describe('itemToForm', () => {
  it('reads an existing item into strings', () => {
    const f = form();
    expect(f.price).toBe('145');
    expect(f.gstPercent).toBe('5');
    expect(f.prepTimeMinutes).toBe('6');
    expect(f.isVeg).toBe('veg');
    expect(f.badge).toBe('');
  });

  it('gives sensible defaults for a new item', () => {
    const f = itemToForm(null, { categoryId: 'c9', defaultGst: 12 });
    expect(f).toMatchObject({
      categoryId: 'c9',
      name: '',
      price: '',
      gstPercent: '12',
      prepTimeMinutes: '10',
      isVeg: 'veg',
      isAvailable: true,
    });
  });
});

describe('itemFormSchema', () => {
  it('accepts the current item', () => {
    expect(itemFormSchema.safeParse(form()).success).toBe(true);
  });

  it('checks the price: more than 0, at most 2 decimals, at most 100000', () => {
    for (const bad of ['0', '-5', '1.234', '', 'abc', '100001']) {
      expect(errorPaths({ price: bad }), bad).toContain('price');
    }
    for (const good of ['0.5', '145', '99.50', '100000']) {
      expect(errorPaths({ price: good }), good).toEqual([]);
    }
  });

  it('checks GST between 0 and 28', () => {
    expect(errorPaths({ gstPercent: '29' })).toContain('gstPercent');
    expect(errorPaths({ gstPercent: '-1' })).toContain('gstPercent');
    expect(errorPaths({ gstPercent: '0' })).toEqual([]);
    expect(errorPaths({ gstPercent: '28' })).toEqual([]);
  });

  it('checks prep time is a whole number from 1 to 240', () => {
    for (const bad of ['0', '241', '1.5', '']) {
      expect(errorPaths({ prepTimeMinutes: bad }), bad).toContain('prepTimeMinutes');
    }
    expect(errorPaths({ prepTimeMinutes: '240' })).toEqual([]);
  });

  it('rejects a blank name, a long description, a bad badge and a bad diet', () => {
    expect(errorPaths({ name: '   ' })).toContain('name');
    expect(errorPaths({ description: 'x'.repeat(501) })).toContain('description');
    expect(errorPaths({ badge: 'bogus' })).toContain('badge');
    expect(errorPaths({ isVeg: 'maybe' })).toContain('isVeg');
    expect(errorPaths({ categoryId: '' })).toContain('categoryId');
  });

  it('accepts every known badge', () => {
    for (const b of ['must_try', 'house_special', 'signature', 'speciality']) {
      expect(errorPaths({ badge: b }), b).toEqual([]);
    }
  });
});

describe('formToItemPayload and diffItem', () => {
  it('turns form text into the API shape', () => {
    const p = formToItemPayload({
      ...form(),
      price: ' 145.50 ',
      description: '  ',
      isVeg: 'nonveg',
      badge: '',
    });
    expect(p.price).toBe(145.5);
    expect(p.description).toBeNull();
    expect(p.isVeg).toBe(false);
    expect(p.badge).toBeNull();
    expect(p.gstPercent).toBe(5);
    expect(p.prepTimeMinutes).toBe(6);
  });

  it('is empty when nothing changed', () => {
    expect(diffItem(form(), form())).toEqual({});
  });

  it('sends only the fields that changed', () => {
    expect(diffItem({ ...form(), price: '150' }, form())).toEqual({ price: 150 });
    expect(diffItem({ ...form(), isVeg: 'nonveg' }, form())).toEqual({ isVeg: false });
    expect(diffItem({ ...form(), badge: 'signature' }, form())).toEqual({ badge: 'signature' });
    expect(diffItem({ ...form(), categoryId: 'c2' }, form())).toEqual({ categoryId: 'c2' });
    expect(diffItem({ ...form(), description: '' }, form())).toEqual({ description: null });
    expect(diffItem({ ...form(), isAvailable: false }, form())).toEqual({ isAvailable: false });
  });
});

describe('categories', () => {
  const category = { id: 'c1', groupName: 'Beverages', name: 'Tea', description: null, isActive: false };
  const catForm = () => categoryToForm(category);

  it('reads a category and defaults a new one to visible', () => {
    expect(catForm()).toEqual({ groupName: 'Beverages', name: 'Tea', description: '', isActive: false });
    expect(categoryToForm(null, { groupName: 'Pizza' })).toEqual({
      groupName: 'Pizza',
      name: '',
      description: '',
      isActive: true,
    });
  });

  it('validates the form', () => {
    expect(categoryFormSchema.safeParse(catForm()).success).toBe(true);
    expect(categoryFormSchema.safeParse({ ...catForm(), name: ' ' }).success).toBe(false);
    expect(categoryFormSchema.safeParse({ ...catForm(), groupName: '' }).success).toBe(false);
    expect(categoryFormSchema.safeParse({ ...catForm(), description: 'x'.repeat(301) }).success).toBe(false);
  });

  it('builds the payload and the diff', () => {
    expect(formToCategoryPayload({ ...catForm(), name: ' Chai ' })).toEqual({
      groupName: 'Beverages',
      name: 'Chai',
      description: null,
      isActive: false,
    });
    expect(diffCategory(catForm(), catForm())).toEqual({});
    expect(diffCategory({ ...catForm(), isActive: true }, catForm())).toEqual({ isActive: true });
    expect(diffCategory({ ...catForm(), description: 'Hot' }, catForm())).toEqual({ description: 'Hot' });
  });
});