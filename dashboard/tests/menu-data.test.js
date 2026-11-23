import { describe, it, expect } from 'vitest';
import { formatPrice } from '../src/lib/format';
import {
  allCategories,
  itemMatches,
  menuStats,
  removeItem,
  reorderGroupCategories,
  searchAll,
  upsertItem,
} from '../src/lib/menuData';

const item = (id, categoryId, extra = {}) => ({
  id,
  categoryId,
  name: id,
  price: 100,
  isVeg: true,
  isAvailable: true,
  variants: [],
  ...extra,
});

const groups = () => [
  {
    name: 'Beverages',
    categories: [
      {
        id: 'c1',
        name: 'Hot Coffee',
        isActive: true,
        sortOrder: 0,
        itemCount: 2,
        items: [
          item('a', 'c1', { name: 'Americano' }),
          item('b', 'c1', { name: 'Latte', isAvailable: false }),
        ],
      },
      {
        id: 'c2',
        name: 'Tea',
        isActive: false,
        sortOrder: 1,
        itemCount: 1,
        items: [item('c', 'c2', { name: 'Masala Tea' })],
      },
      { id: 'c3', name: 'Cold Coffee', isActive: true, sortOrder: 2, itemCount: 0, items: [] },
    ],
  },
  {
    name: 'Pizza',
    categories: [
      {
        id: 'c4',
        name: 'Classic',
        isActive: true,
        sortOrder: 5,
        itemCount: 1,
        items: [item('d', 'c4', { name: 'Chicken Pizza', isVeg: false })],
      },
    ],
  },
];

describe('formatPrice', () => {
  it('formats whole and fractional prices', () => {
    expect(formatPrice(145)).toBe('\u20B9145');
    expect(formatPrice(1250)).toBe('\u20B91,250');
    expect(formatPrice(99.5)).toBe('\u20B999.50');
    expect(formatPrice('abc')).toBe('');
  });
});

describe('allCategories and menuStats', () => {
  it('flattens categories with their group name', () => {
    const list = allCategories(groups());
    expect(list.map((c) => c.id)).toEqual(['c1', 'c2', 'c3', 'c4']);
    expect(list[3].groupName).toBe('Pizza');
  });

  it('counts items, unavailable items, categories and hidden categories', () => {
    expect(menuStats(groups())).toEqual({ items: 4, unavailable: 1, categories: 4, hidden: 1 });
  });
});

describe('itemMatches and searchAll', () => {
  it('filters by diet, availability and a case-insensitive name search', () => {
    const veg = item('x', 'c1', { name: 'Paneer Tikka' });
    const nonVeg = item('y', 'c1', { name: 'Chicken Tikka', isVeg: false });
    const off = item('z', 'c1', { isAvailable: false });
    expect(itemMatches(veg, { diet: 'veg' })).toBe(true);
    expect(itemMatches(nonVeg, { diet: 'veg' })).toBe(false);
    expect(itemMatches(veg, { diet: 'nonveg' })).toBe(false);
    expect(itemMatches(off, { unavailableOnly: true })).toBe(true);
    expect(itemMatches(veg, { unavailableOnly: true })).toBe(false);
    expect(itemMatches(veg, { query: '  PANEER ' })).toBe(true);
    expect(itemMatches(veg, { query: 'chicken' })).toBe(false);
  });

  it('searches the whole menu and reports where each match lives', () => {
    const found = searchAll(groups(), { query: 'latte' });
    expect(found).toHaveLength(1);
    expect(found[0].categoryName).toBe('Hot Coffee');
    expect(found[0].groupName).toBe('Beverages');
    expect(searchAll(groups(), { diet: 'nonveg' }).map((r) => r.item.id)).toEqual(['d']);
    expect(searchAll(groups(), { unavailableOnly: true }).map((r) => r.item.id)).toEqual(['b']);
  });
});

describe('upsertItem and removeItem', () => {
  it('replaces an existing item in place', () => {
    const next = upsertItem(groups(), item('a', 'c1', { name: 'Americano Large' }));
    const c1 = next[0].categories[0];
    expect(c1.items[0].name).toBe('Americano Large');
    expect(c1.items).toHaveLength(2);
    expect(c1.itemCount).toBe(2);
  });

  it('adds a new item to the end of its category and updates the count', () => {
    const next = upsertItem(groups(), item('e', 'c3'));
    const c3 = next[0].categories[2];
    expect(c3.items.map((i) => i.id)).toEqual(['e']);
    expect(c3.itemCount).toBe(1);
  });

  it('moves an item when its category changes', () => {
    const next = upsertItem(groups(), item('a', 'c3', { name: 'Americano' }));
    expect(next[0].categories[0].items.map((i) => i.id)).toEqual(['b']);
    expect(next[0].categories[0].itemCount).toBe(1);
    expect(next[0].categories[2].items.map((i) => i.id)).toEqual(['a']);
    expect(next[0].categories[2].itemCount).toBe(1);
  });

  it('removes an item and updates the count', () => {
    const next = removeItem(groups(), 'a');
    expect(next[0].categories[0].items.map((i) => i.id)).toEqual(['b']);
    expect(next[0].categories[0].itemCount).toBe(1);
  });

  it('never changes the data it was given', () => {
    const g = groups();
    upsertItem(g, item('e', 'c3'));
    upsertItem(g, item('a', 'c3'));
    removeItem(g, 'a');
    expect(g[0].categories[0].items).toHaveLength(2);
    expect(g[0].categories[2].items).toHaveLength(0);
  });
});

describe('reorderGroupCategories', () => {
  it('reorders one group and reuses its sort slots', () => {
    const next = reorderGroupCategories(groups(), 'Beverages', ['c3', 'c1', 'c2']);
    expect(next[0].categories.map((c) => c.id)).toEqual(['c3', 'c1', 'c2']);
    expect(next[0].categories.map((c) => c.sortOrder)).toEqual([0, 1, 2]);
    // expect(next[1]).toBe(groups.length ? next[1] : null);
    expect(next[1].categories[0].sortOrder).toBe(5);
  });

  it('keeps non-contiguous slots', () => {
    const g = groups();
    g[0].categories[0].sortOrder = 0;
    g[0].categories[1].sortOrder = 4;
    g[0].categories[2].sortOrder = 9;
    const next = reorderGroupCategories(g, 'Beverages', ['c2', 'c3', 'c1']);
    expect(next[0].categories.map((c) => c.sortOrder)).toEqual([0, 4, 9]);
  });

  it('ignores an unknown group or an incomplete id list', () => {
    const g = groups();
    expect(reorderGroupCategories(g, 'Nope', ['c1'])).toBe(g);
    expect(reorderGroupCategories(g, 'Beverages', ['c1', 'c2'])).toBe(g);
    expect(reorderGroupCategories(g, 'Beverages', ['c1', 'c2', 'zzz'])).toBe(g);
  });
});