import { describe, it, expect } from 'vitest';
import {
  findItem,
  removeVariant,
  reorderCategoryItems,
  upsertVariant,
} from '../src/lib/menuEdit';

const variant = (id, label, price = 100) => ({ id, label, price, isAvailable: true });
const item = (id, categoryId, sortOrder, variants = []) => ({
  id,
  categoryId,
  name: `Item ${id}`,
  sortOrder,
  variants,
});
const makeGroups = () => [
  {
    name: 'Pizza',
    categories: [
      {
        id: 'c1',
        name: 'Classic',
        itemCount: 3,
        items: [item('a', 'c1', 1), item('b', 'c1', 2, [variant('v1', 'Small', 200)]), item('c', 'c1', 3)],
      },
      { id: 'c2', name: 'Pan', itemCount: 1, items: [item('d', 'c2', 1)] },
    ],
  },
  { name: 'Desserts', categories: [{ id: 'c3', name: 'Cakes', itemCount: 0, items: [] }] },
];

describe('findItem', () => {
  it('finds an item in any category', () => {
    expect(findItem(makeGroups(), 'd').id).toBe('d');
  });
  it('returns null for an unknown id', () => {
    expect(findItem(makeGroups(), 'zzz')).toBeNull();
  });
});

describe('upsertVariant', () => {
  it('adds a new size at the end without touching the input', () => {
    const groups = makeGroups();
    const out = upsertVariant(groups, 'b', variant('v2', 'Large', 300));
    expect(findItem(out, 'b').variants.map((v) => v.id)).toEqual(['v1', 'v2']);
    expect(findItem(groups, 'b').variants).toHaveLength(1);
  });

  it('adds the first size to an item with none', () => {
    const out = upsertVariant(makeGroups(), 'a', variant('v9', 'Regular'));
    expect(findItem(out, 'a').variants.map((v) => v.id)).toEqual(['v9']);
  });

  it('replaces an existing size in place', () => {
    const out = upsertVariant(makeGroups(), 'b', { id: 'v1', label: 'Small', price: 250, isAvailable: false });
    const sizes = findItem(out, 'b').variants;
    expect(sizes).toHaveLength(1);
    expect(sizes[0].price).toBe(250);
    expect(sizes[0].isAvailable).toBe(false);
  });

  it('leaves everything unchanged for an unknown item', () => {
    const groups = makeGroups();
    expect(upsertVariant(groups, 'nope', variant('v9', 'X'))).toEqual(groups);
  });
});

describe('removeVariant', () => {
  it('removes only that size', () => {
    const groups = upsertVariant(makeGroups(), 'b', variant('v2', 'Large'));
    const out = removeVariant(groups, 'b', 'v1');
    expect(findItem(out, 'b').variants.map((v) => v.id)).toEqual(['v2']);
  });
});

describe('reorderCategoryItems', () => {
  it('applies the new order and reuses the existing sort slots', () => {
    const out = reorderCategoryItems(makeGroups(), 'c1', ['c', 'a', 'b']);
    const items = out[0].categories[0].items;
    expect(items.map((i) => i.id)).toEqual(['c', 'a', 'b']);
    expect(items.map((i) => i.sortOrder)).toEqual([1, 2, 3]);
  });

  it('keeps other categories exactly as they were', () => {
    const groups = makeGroups();
    const out = reorderCategoryItems(groups, 'c1', ['c', 'a', 'b']);
    expect(out[0].categories[1]).toBe(groups[0].categories[1]);
    expect(out[1]).toEqual(groups[1]);
  });

  it('does not change the input', () => {
    const groups = makeGroups();
    const before = JSON.stringify(groups);
    reorderCategoryItems(groups, 'c1', ['c', 'a', 'b']);
    expect(JSON.stringify(groups)).toBe(before);
  });

  it('ignores a list that is not exactly the category items', () => {
    const groups = makeGroups();
    expect(reorderCategoryItems(groups, 'c1', ['a', 'b'])).toBe(groups);
    expect(reorderCategoryItems(groups, 'c1', ['a', 'b', 'c', 'd'])).toBe(groups);
    expect(reorderCategoryItems(groups, 'c1', ['a', 'b', 'x'])).toBe(groups);
    expect(reorderCategoryItems(groups, 'c1', ['a', 'a', 'b'])).toBe(groups);
  });

  it('ignores an unknown category', () => {
    const groups = makeGroups();
    expect(reorderCategoryItems(groups, 'nope', ['a'])).toBe(groups);
  });
});