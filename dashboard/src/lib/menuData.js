export const DIETS = [
  ['all', 'All'],
  ['veg', 'Veg'],
  ['nonveg', 'Non-veg'],
];

// Flat list of categories, each with its group name.
export function allCategories(groups) {
  return groups.flatMap((g) => g.categories.map((c) => ({ ...c, groupName: g.name })));
}

export function menuStats(groups) {
  let items = 0;
  let unavailable = 0;
  let categories = 0;
  let hidden = 0;
  for (const g of groups) {
    for (const c of g.categories) {
      categories += 1;
      if (!c.isActive) hidden += 1;
      for (const i of c.items) {
        items += 1;
        if (!i.isAvailable) unavailable += 1;
      }
    }
  }
  return { items, unavailable, categories, hidden };
}

const normalize = (s) => String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();

export function itemMatches(item, { query = '', diet = 'all', unavailableOnly = false } = {}) {
  if (diet === 'veg' && !item.isVeg) return false;
  if (diet === 'nonveg' && item.isVeg) return false;
  if (unavailableOnly && item.isAvailable) return false;
  const q = normalize(query);
  return q === '' || normalize(item.name).includes(q);
}

// Every matching item across the whole menu, with where it lives.
export function searchAll(groups, filters) {
  const out = [];
  for (const g of groups) {
    for (const c of g.categories) {
      for (const item of c.items) {
        if (itemMatches(item, filters)) out.push({ item, categoryName: c.name, groupName: g.name });
      }
    }
  }
  return out;
}

export function removeItem(groups, itemId) {
  return groups.map((g) => ({
    ...g,
    categories: g.categories.map((c) => {
      if (!c.items.some((i) => i.id === itemId)) return c;
      const items = c.items.filter((i) => i.id !== itemId);
      return { ...c, items, itemCount: items.length };
    }),
  }));
}

// Replaces the item in place, or moves it to the end of its (new) category.
export function upsertItem(groups, item) {
  const inPlace = groups.some((g) =>
    g.categories.some((c) => c.id === item.categoryId && c.items.some((i) => i.id === item.id)),
  );
  if (inPlace) {
    return groups.map((g) => ({
      ...g,
      categories: g.categories.map((c) =>
        c.id === item.categoryId
          ? { ...c, items: c.items.map((i) => (i.id === item.id ? item : i)) }
          : c,
      ),
    }));
  }
  return removeItem(groups, item.id).map((g) => ({
    ...g,
    categories: g.categories.map((c) =>
      c.id === item.categoryId
        ? { ...c, items: [...c.items, item], itemCount: c.items.length + 1 }
        : c,
    ),
  }));
}

// Mirrors the server: the new order reuses the sort slots the group already occupies.
export function reorderGroupCategories(groups, groupName, ids) {
  const group = groups.find((g) => g.name === groupName);
  if (!group) return groups;
  const byId = new Map(group.categories.map((c) => [c.id, c]));
  if (ids.length !== byId.size || ids.some((id) => !byId.has(id))) return groups;
  const slots = group.categories.map((c) => c.sortOrder).sort((a, b) => a - b);
  const categories = ids.map((id, i) => ({ ...byId.get(id), sortOrder: slots[i] }));
  return groups.map((g) => (g === group ? { ...g, categories } : g));
}
