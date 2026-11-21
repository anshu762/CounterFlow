import { randomUUID } from 'node:crypto';
import {
  categoryNotFound,
  categoryNameTaken,
  categoryNotEmpty,
  itemNotFound,
  itemNameTaken,
  variantNotFound,
  variantLabelTaken,
  invalidOrder,
} from '../../src/modules/menu/menu.errors.js';
import { slotValues } from '../../src/modules/menu/menu.util.js';

export function createMemoryMenuStore() {
  const categories = new Map();
  const items = new Map();
  const variants = new Map();
  const deleted = new Set();

  const copy = (x) => ({ ...x });
  const same = (a, b) => a.toLowerCase() === b.toLowerCase();
  const byOrder = (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);
  const liveItems = () => [...items.values()].filter((i) => !deleted.has(i.id));
  const nextSort = (list) => (list.length ? Math.max(...list.map((x) => x.sortOrder)) + 1 : 0);
  const apply = (target, patch) => {
    for (const [k, v] of Object.entries(patch)) if (v !== undefined) target[k] = v;
  };

  const store = {
    async listCategories({ activeOnly = false } = {}) {
      return [...categories.values()]
        .filter((c) => !activeOnly || c.isActive)
        .sort(byOrder)
        .map(copy);
    },
    async getCategory(id) {
      return categories.has(id) ? copy(categories.get(id)) : null;
    },
    async createCategory(input) {
      if ([...categories.values()].some((c) => same(c.name, input.name))) throw categoryNameTaken();
      const cat = {
        id: randomUUID(),
        groupName: input.groupName,
        name: input.name,
        description: input.description ?? null,
        isActive: input.isActive ?? true,
        sortOrder: nextSort([...categories.values()]),
      };
      categories.set(cat.id, cat);
      return copy(cat);
    },
    async updateCategory(id, patch) {
      const cat = categories.get(id);
      if (!cat) throw categoryNotFound();
      if (
        patch.name !== undefined &&
        [...categories.values()].some((c) => c.id !== id && same(c.name, patch.name))
      ) {
        throw categoryNameTaken();
      }
      apply(cat, patch);
      return copy(cat);
    },
    async deleteCategory(id) {
      if (!categories.has(id)) throw categoryNotFound();
      if ([...items.values()].some((i) => i.categoryId === id)) throw categoryNotEmpty();
      categories.delete(id);
    },
    async reorderCategories(ids) {
      if (!ids.every((id) => categories.has(id))) throw categoryNotFound();
      const values = slotValues(ids.map((id) => categories.get(id).sortOrder));
      ids.forEach((id, i) => {
        categories.get(id).sortOrder = values[i];
      });
    },

    async listItems({ availableOnly = false, categoryId = null, veg = null } = {}) {
      return liveItems()
        .filter(
          (i) =>
            (!availableOnly || i.isAvailable) &&
            (!categoryId || i.categoryId === categoryId) &&
            (veg === null || i.isVeg === veg),
        )
        .sort(byOrder)
        .map(copy);
    },
    async getItem(id) {
      return items.has(id) && !deleted.has(id) ? copy(items.get(id)) : null;
    },
    async createItem(input) {
      const siblings = liveItems().filter((i) => i.categoryId === input.categoryId);
      if (siblings.some((i) => same(i.name, input.name))) throw itemNameTaken();
      const item = {
        id: randomUUID(),
        categoryId: input.categoryId,
        name: input.name,
        description: input.description ?? null,
        price: input.price,
        gstPercent: input.gstPercent,
        prepTimeMinutes: input.prepTimeMinutes,
        isVeg: input.isVeg,
        isAvailable: input.isAvailable,
        badge: input.badge ?? null,
        imageUrl: null,
        imagePublicId: null,
        imageCredit: null,
        sortOrder: nextSort(siblings),
      };
      items.set(item.id, item);
      return copy(item);
    },
    async updateItem(id, patch) {
      const item = items.get(id);
      if (!item || deleted.has(id)) throw itemNotFound();
      const targetCategory = patch.categoryId ?? item.categoryId;
      const targetName = patch.name ?? item.name;
      if (
        liveItems().some(
          (i) => i.id !== id && i.categoryId === targetCategory && same(i.name, targetName),
        )
      ) {
        throw itemNameTaken();
      }
      let changes = patch;
      if (patch.categoryId !== undefined && patch.categoryId !== item.categoryId) {
        if (!categories.has(patch.categoryId)) throw categoryNotFound();
        const siblings = liveItems().filter((i) => i.categoryId === patch.categoryId);
        changes = { ...patch, sortOrder: nextSort(siblings) };
      }
      apply(item, changes);
      return copy(item);
    },
    async softDeleteItem(id) {
      if (!items.has(id) || deleted.has(id)) throw itemNotFound();
      deleted.add(id);
      items.get(id).isAvailable = false;
    },
    async setItemImage(id, { url, publicId, credit }) {
      const item = items.get(id);
      if (!item || deleted.has(id)) throw itemNotFound();
      item.imageUrl = url;
      item.imagePublicId = publicId;
      item.imageCredit = credit;
      return copy(item);
    },
    async reorderItems(categoryId, ids) {
      if (!categories.has(categoryId)) throw categoryNotFound();
      const ok = ids.every((id) => {
        const it = items.get(id);
        return it && !deleted.has(id) && it.categoryId === categoryId;
      });
      if (!ok) throw invalidOrder('Some items do not belong to this category');
      const values = slotValues(ids.map((id) => items.get(id).sortOrder));
      ids.forEach((id, i) => {
        items.get(id).sortOrder = values[i];
      });
    },

    async listVariants({ itemId = null, availableOnly = false } = {}) {
      return [...variants.values()]
        .filter(
          (v) =>
            !deleted.has(v.itemId) &&
            (!itemId || v.itemId === itemId) &&
            (!availableOnly || v.isAvailable),
        )
        .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label))
        .map(copy);
    },
    async getVariant(variantId) {
      const v = variants.get(variantId);
      return v && !deleted.has(v.itemId) ? copy(v) : null;
    },
    async createVariant(itemId, input) {
      const siblings = [...variants.values()].filter((v) => v.itemId === itemId);
      if (siblings.some((v) => same(v.label, input.label))) throw variantLabelTaken();
      const v = {
        id: randomUUID(),
        itemId,
        label: input.label,
        price: input.price,
        isAvailable: input.isAvailable ?? true,
        sortOrder: nextSort(siblings),
      };
      variants.set(v.id, v);
      return copy(v);
    },
    async updateVariant(variantId, patch) {
      const v = variants.get(variantId);
      if (!v) throw variantNotFound();
      if (
        patch.label !== undefined &&
        [...variants.values()].some(
          (o) => o.id !== variantId && o.itemId === v.itemId && same(o.label, patch.label),
        )
      ) {
        throw variantLabelTaken();
      }
      apply(v, patch);
      return copy(v);
    },
    async deleteVariant(variantId) {
      if (!variants.has(variantId)) throw variantNotFound();
      variants.delete(variantId);
    },
  };
  return store;
}
