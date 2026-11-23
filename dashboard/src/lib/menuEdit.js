// Pure helpers that patch the cached admin menu: [{ name, categories: [{ id, items: [...] }] }]

export function findItem(groups, itemId) {
  for (const g of groups) {
    for (const c of g.categories) {
      const hit = c.items.find((i) => i.id === itemId);
      if (hit) return hit;
    }
  }
  return null;
}

function mapItem(groups, itemId, change) {
  return groups.map((g) => ({
    ...g,
    categories: g.categories.map((c) =>
      c.items.some((i) => i.id === itemId)
        ? { ...c, items: c.items.map((i) => (i.id === itemId ? change(i) : i)) }
        : c,
    ),
  }));
}

// Replaces the size in place, or adds it at the end.
export function upsertVariant(groups, itemId, variant) {
  return mapItem(groups, itemId, (item) => {
    const list = item.variants ?? [];
    const exists = list.some((v) => v.id === variant.id);
    return {
      ...item,
      variants: exists
        ? list.map((v) => (v.id === variant.id ? { ...v, ...variant } : v))
        : [...list, variant],
    };
  });
}

export function removeVariant(groups, itemId, variantId) {
  return mapItem(groups, itemId, (item) => ({
    ...item,
    variants: (item.variants ?? []).filter((v) => v.id !== variantId),
  }));
}

// New order for the items of one category. Returns `groups` untouched if `ids`
// is not exactly the category's items, each once.
export function reorderCategoryItems(groups, categoryId, ids) {
  const category = groups.flatMap((g) => g.categories).find((c) => c.id === categoryId);
  if (!category) return groups;
  const byId = new Map(category.items.map((i) => [i.id, i]));
  if (
    ids.length !== byId.size ||
    new Set(ids).size !== ids.length ||
    ids.some((id) => !byId.has(id))
  ) {
    return groups;
  }
  const slots = category.items.map((i) => i.sortOrder).sort((a, b) => a - b);
  const items = ids.map((id, n) => ({
    ...byId.get(id),
    sortOrder: slots[n] ?? byId.get(id).sortOrder,
  }));
  return groups.map((g) => ({
    ...g,
    categories: g.categories.map((c) => (c === category ? { ...c, items } : c)),
  }));
}