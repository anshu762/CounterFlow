import { AppError } from '../../utils/errors.js';
import { detectImageType } from '../uploads/imageType.js';
import { categoryNotFound, itemNotFound } from './menu.errors.js';

const publicVariant = (v) => ({ id: v.id, label: v.label, price: v.price });
const adminVariant = (v) => ({
  id: v.id,
  label: v.label,
  price: v.price,
  isAvailable: v.isAvailable,
});

const publicItem = (it, variants) => ({
  id: it.id,
  categoryId: it.categoryId,
  name: it.name,
  description: it.description,
  price: it.price,
  gstPercent: it.gstPercent,
  prepTimeMinutes: it.prepTimeMinutes,
  isVeg: it.isVeg,
  badge: it.badge,
  imageUrl: it.imageUrl,
  imageCredit: it.imageCredit,
  variants: variants.map(publicVariant),
});

const adminItem = (it, variants) => ({
  ...publicItem(it, []),
  isAvailable: it.isAvailable,
  hasOwnImage: Boolean(it.imagePublicId),
  sortOrder: it.sortOrder,
  variants: variants.map(adminVariant),
});

function indexBy(list, key) {
  const map = new Map();
  for (const x of list) {
    const k = x[key];
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(x);
  }
  return map;
}

// Categories arrive sorted, so groups appear in the order of their first category.
function buildGroups(categories, itemsByCategory, { keepEmpty, mapItem, mapCategory }) {
  const groups = [];
  const byName = new Map();
  for (const c of categories) {
    const items = itemsByCategory.get(c.id) ?? [];
    if (!keepEmpty && items.length === 0) continue;
    let group = byName.get(c.groupName);
    if (!group) {
      group = { name: c.groupName, categories: [] };
      byName.set(c.groupName, group);
      groups.push(group);
    }
    group.categories.push({ ...mapCategory(c, items.length), items: items.map(mapItem) });
  }
  return groups;
}

export function createMenuService({ store, imageStorage }) {
  async function adminItemById(id) {
    const item = await store.getItem(id);
    if (!item) throw itemNotFound();
    return adminItem(item, await store.listVariants({ itemId: id }));
  }

  return {
    // ---------- public ----------
    async getPublicMenu({ veg = null } = {}) {
      const [categories, items, variants] = await Promise.all([
        store.listCategories({ activeOnly: true }),
        store.listItems({ availableOnly: true, veg }),
        store.listVariants({ availableOnly: true }),
      ]);
      const variantsByItem = indexBy(variants, 'itemId');
      const groups = buildGroups(categories, indexBy(items, 'categoryId'), {
        keepEmpty: false,
        mapItem: (it) => publicItem(it, variantsByItem.get(it.id) ?? []),
        mapCategory: (c) => ({ id: c.id, name: c.name, description: c.description }),
      });
      return { groups };
    },

    async getPublicItem(id) {
      const item = await store.getItem(id);
      if (!item || !item.isAvailable) throw itemNotFound();
      const category = await store.getCategory(item.categoryId);
      if (!category || !category.isActive) throw itemNotFound();
      const variants = await store.listVariants({ itemId: id, availableOnly: true });
      return { item: publicItem(item, variants) };
    },

    // ---------- admin reads ----------
    async getAdminMenu() {
      const [categories, items, variants] = await Promise.all([
        store.listCategories(),
        store.listItems(),
        store.listVariants(),
      ]);
      const variantsByItem = indexBy(variants, 'itemId');
      const groups = buildGroups(categories, indexBy(items, 'categoryId'), {
        keepEmpty: true,
        mapItem: (it) => adminItem(it, variantsByItem.get(it.id) ?? []),
        mapCategory: (c, count) => ({
          id: c.id,
          name: c.name,
          description: c.description,
          isActive: c.isActive,
          sortOrder: c.sortOrder,
          itemCount: count,
        }),
      });
      return { groups };
    },

    async getAdminItem(id) {
      return { item: await adminItemById(id) };
    },

    // ---------- categories ----------
    async createCategory(input) {
      return { category: await store.createCategory(input) };
    },
    async updateCategory(id, input) {
      return { category: await store.updateCategory(id, input) };
    },
    async deleteCategory(id) {
      await store.deleteCategory(id);
    },
    async reorderCategories(ids) {
      await store.reorderCategories(ids);
    },

    // ---------- items ----------
    async createItem(input) {
      if (!(await store.getCategory(input.categoryId))) throw categoryNotFound();
      const item = await store.createItem(input);
      return { item: adminItem(item, []) };
    },
    async updateItem(id, input) {
      await store.updateItem(id, input);
      return { item: await adminItemById(id) };
    },
    async setItemAvailability(id, isAvailable) {
      await store.updateItem(id, { isAvailable });
      return { item: await adminItemById(id) };
    },
    async deleteItem(id) {
      await store.softDeleteItem(id);
    },
    async reorderItems(categoryId, ids) {
      await store.reorderItems(categoryId, ids);
    },

    // ---------- variants ----------
    async createVariant(itemId, input) {
      if (!(await store.getItem(itemId))) throw itemNotFound();
      return { variant: adminVariant(await store.createVariant(itemId, input)) };
    },
    async updateVariant(variantId, input) {
      return { variant: adminVariant(await store.updateVariant(variantId, input)) };
    },
    async deleteVariant(variantId) {
      await store.deleteVariant(variantId);
    },

    // ---------- images ----------
    async uploadItemImage(id, buffer) {
      const item = await store.getItem(id);
      if (!item) throw itemNotFound();
      if (!detectImageType(buffer)) {
        throw new AppError('Only JPG, PNG or WebP images are allowed', 415, 'UNSUPPORTED_IMAGE');
      }
      let uploaded;
      try {
        uploaded = await imageStorage.upload(buffer, {
          publicId: `counterflow/menu/own/${id}`,
        });
      } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError('Image upload failed. Please try again.', 502, 'UPLOAD_FAILED', {
          reason: String(err?.message ?? err),
        });
      }
      // Only our own uploads keep a public id. Stock (Pixabay) images are shared
      // between items and are never deleted from Cloudinary.
      await store.setItemImage(id, {
        url: uploaded.url,
        publicId: uploaded.publicId,
        credit: null,
      });
      if (item.imagePublicId && item.imagePublicId !== uploaded.publicId) {
        await imageStorage.destroy(item.imagePublicId).catch(() => {});
      }
      return { item: await adminItemById(id) };
    },

    async removeItemImage(id) {
      const item = await store.getItem(id);
      if (!item) throw itemNotFound();
      await store.setItemImage(id, { url: null, publicId: null, credit: null });
      if (item.imagePublicId) await imageStorage.destroy(item.imagePublicId).catch(() => {});
      return { item: await adminItemById(id) };
    },
  };
}
