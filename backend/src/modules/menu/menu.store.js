import {
  categoryNotFound,
  categoryNameTaken,
  categoryNotEmpty,
  itemNotFound,
  itemNameTaken,
  variantNotFound,
  variantLabelTaken,
  invalidOrder,
} from './menu.errors.js';
import { slotValues } from './menu.util.js';

const CATEGORY_COLS = 'category_id, group_name, name, description, sort_order, is_active';
const ITEM_COLS =
  'item_id, category_id, name, description, price, gst_percent, prep_time_minutes, is_veg, is_available, badge, image_url, image_public_id, image_credit, sort_order';
const VARIANT_RET = 'variant_id, item_id, label, price, is_available, sort_order';
const VARIANT_JOINED = 'v.variant_id, v.item_id, v.label, v.price, v.is_available, v.sort_order';

const CATEGORY_FIELDS = {
  groupName: 'group_name',
  name: 'name',
  description: 'description',
  isActive: 'is_active',
};
const ITEM_FIELDS = {
  categoryId: 'category_id',
  name: 'name',
  description: 'description',
  price: 'price',
  gstPercent: 'gst_percent',
  prepTimeMinutes: 'prep_time_minutes',
  isVeg: 'is_veg',
  isAvailable: 'is_available',
  badge: 'badge',
  sortOrder: 'sort_order',
};
const VARIANT_FIELDS = { label: 'label', price: 'price', isAvailable: 'is_available' };

const toCategory = (r) => ({
  id: r.category_id,
  groupName: r.group_name,
  name: r.name,
  description: r.description,
  sortOrder: r.sort_order,
  isActive: r.is_active,
});
const toItem = (r) => ({
  id: r.item_id,
  categoryId: r.category_id,
  name: r.name,
  description: r.description,
  price: Number(r.price),
  gstPercent: Number(r.gst_percent),
  prepTimeMinutes: r.prep_time_minutes,
  isVeg: r.is_veg,
  isAvailable: r.is_available,
  badge: r.badge,
  imageUrl: r.image_url,
  imagePublicId: r.image_public_id,
  imageCredit: r.image_credit,
  sortOrder: r.sort_order,
});
const toVariant = (r) => ({
  id: r.variant_id,
  itemId: r.item_id,
  label: r.label,
  price: Number(r.price),
  isAvailable: r.is_available,
  sortOrder: r.sort_order,
});

const isUnique = (e) => e?.code === '23505';
const isRestrict = (e) => e?.code === '23001' || e?.code === '23503';

function setClause(fields, patch) {
  const sets = [];
  const values = [];
  for (const [key, column] of Object.entries(fields)) {
    if (patch[key] !== undefined) {
      values.push(patch[key]);
      sets.push(`${column} = $${values.length}`);
    }
  }
  return { sets, values };
}

async function inTransaction(pool, fn) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const out = await fn(client);
    await client.query('commit');
    return out;
  } catch (err) {
    await client.query('rollback').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export function createMenuStore(pool) {
  const store = {
    // ---------- categories ----------
    async listCategories({ activeOnly = false } = {}) {
      const { rows } = await pool.query(
        `select ${CATEGORY_COLS} from menu_categories
         ${activeOnly ? 'where is_active' : ''}
         order by sort_order, lower(name)`,
      );
      return rows.map(toCategory);
    },

    async getCategory(id) {
      const { rows } = await pool.query(
        `select ${CATEGORY_COLS} from menu_categories where category_id = $1`,
        [id],
      );
      return rows[0] ? toCategory(rows[0]) : null;
    },

    async createCategory(input) {
      try {
        const { rows } = await pool.query(
          `insert into menu_categories (group_name, name, description, is_active, sort_order)
           values ($1, $2, $3, $4, (select coalesce(max(sort_order), -1) + 1 from menu_categories))
           returning ${CATEGORY_COLS}`,
          [input.groupName, input.name, input.description ?? null, input.isActive ?? true],
        );
        return toCategory(rows[0]);
      } catch (err) {
        if (isUnique(err)) throw categoryNameTaken();
        throw err;
      }
    },

    async updateCategory(id, patch) {
      const { sets, values } = setClause(CATEGORY_FIELDS, patch);
      try {
        const { rows } = await pool.query(
          `update menu_categories set ${sets.join(', ')}
           where category_id = $${values.length + 1} returning ${CATEGORY_COLS}`,
          [...values, id],
        );
        if (!rows[0]) throw categoryNotFound();
        return toCategory(rows[0]);
      } catch (err) {
        if (isUnique(err)) throw categoryNameTaken();
        throw err;
      }
    },

    async deleteCategory(id) {
      try {
        const { rowCount } = await pool.query(
          'delete from menu_categories where category_id = $1',
          [id],
        );
        if (!rowCount) throw categoryNotFound();
      } catch (err) {
        if (isRestrict(err)) throw categoryNotEmpty();
        throw err;
      }
    },

    async reorderCategories(ids) {
      await inTransaction(pool, async (c) => {
        const { rows } = await c.query(
          `select category_id, sort_order from menu_categories
           where category_id = any($1::uuid[]) order by category_id for update`,
          [ids],
        );
        if (rows.length !== ids.length) throw categoryNotFound();
        const values = slotValues(rows.map((r) => r.sort_order));
        await c.query(
          `update menu_categories m set sort_order = v.sort_order
           from unnest($1::uuid[], $2::int[]) as v(id, sort_order)
           where m.category_id = v.id`,
          [ids, values],
        );
      });
    },

    // ---------- items ----------
    async listItems({ availableOnly = false, categoryId = null, veg = null } = {}) {
      const where = ['deleted_at is null'];
      const params = [];
      if (availableOnly) where.push('is_available');
      if (categoryId) {
        params.push(categoryId);
        where.push(`category_id = $${params.length}`);
      }
      if (veg !== null) {
        params.push(veg);
        where.push(`is_veg = $${params.length}`);
      }
      const { rows } = await pool.query(
        `select ${ITEM_COLS} from menu_items
         where ${where.join(' and ')} order by sort_order, lower(name)`,
        params,
      );
      return rows.map(toItem);
    },

    async getItem(id) {
      const { rows } = await pool.query(
        `select ${ITEM_COLS} from menu_items where item_id = $1 and deleted_at is null`,
        [id],
      );
      return rows[0] ? toItem(rows[0]) : null;
    },

    async createItem(input) {
      try {
        const { rows } = await pool.query(
          `insert into menu_items
             (category_id, name, description, price, gst_percent, prep_time_minutes,
              is_veg, is_available, badge, sort_order)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9,
             (select coalesce(max(sort_order), -1) + 1 from menu_items
              where category_id = $1 and deleted_at is null))
           returning ${ITEM_COLS}`,
          [
            input.categoryId,
            input.name,
            input.description ?? null,
            input.price,
            input.gstPercent,
            input.prepTimeMinutes,
            input.isVeg,
            input.isAvailable,
            input.badge ?? null,
          ],
        );
        return toItem(rows[0]);
      } catch (err) {
        if (isUnique(err)) throw itemNameTaken();
        throw err;
      }
    },

    async updateItem(id, patch) {
      const current = await store.getItem(id);
      if (!current) throw itemNotFound();
      let changes = patch;
      if (patch.categoryId !== undefined && patch.categoryId !== current.categoryId) {
        if (!(await store.getCategory(patch.categoryId))) throw categoryNotFound();
        const { rows } = await pool.query(
          `select coalesce(max(sort_order), -1) + 1 as next from menu_items
           where category_id = $1 and deleted_at is null`,
          [patch.categoryId],
        );
        changes = { ...patch, sortOrder: rows[0].next };
      }
      const { sets, values } = setClause(ITEM_FIELDS, changes);
      try {
        const { rows } = await pool.query(
          `update menu_items set ${sets.join(', ')}
           where item_id = $${values.length + 1} and deleted_at is null returning ${ITEM_COLS}`,
          [...values, id],
        );
        if (!rows[0]) throw itemNotFound();
        return toItem(rows[0]);
      } catch (err) {
        if (isUnique(err)) throw itemNameTaken();
        throw err;
      }
    },

    async softDeleteItem(id) {
      const { rowCount } = await pool.query(
        `update menu_items set deleted_at = now(), is_available = false
         where item_id = $1 and deleted_at is null`,
        [id],
      );
      if (!rowCount) throw itemNotFound();
    },

    async setItemImage(id, { url, publicId, credit }) {
      const { rows } = await pool.query(
        `update menu_items set image_url = $1, image_public_id = $2, image_credit = $3
         where item_id = $4 and deleted_at is null returning ${ITEM_COLS}`,
        [url, publicId, credit, id],
      );
      if (!rows[0]) throw itemNotFound();
      return toItem(rows[0]);
    },

    async reorderItems(categoryId, ids) {
      if (!(await store.getCategory(categoryId))) throw categoryNotFound();
      await inTransaction(pool, async (c) => {
        const { rows } = await c.query(
          `select item_id, sort_order from menu_items
           where category_id = $1 and deleted_at is null and item_id = any($2::uuid[])
           order by item_id for update`,
          [categoryId, ids],
        );
        if (rows.length !== ids.length) {
          throw invalidOrder('Some items do not belong to this category');
        }
        const values = slotValues(rows.map((r) => r.sort_order));
        await c.query(
          `update menu_items m set sort_order = v.sort_order
           from unnest($1::uuid[], $2::int[]) as v(id, sort_order)
           where m.item_id = v.id`,
          [ids, values],
        );
      });
    },

    // ---------- variants ----------
    async listVariants({ itemId = null, availableOnly = false } = {}) {
      const where = ['i.deleted_at is null'];
      const params = [];
      if (itemId) {
        params.push(itemId);
        where.push(`v.item_id = $${params.length}`);
      }
      if (availableOnly) where.push('v.is_available');
      const { rows } = await pool.query(
        `select ${VARIANT_JOINED} from menu_item_variants v
         join menu_items i on i.item_id = v.item_id
         where ${where.join(' and ')} order by v.sort_order, lower(v.label)`,
        params,
      );
      return rows.map(toVariant);
    },

    async getVariant(variantId) {
      const { rows } = await pool.query(
        `select ${VARIANT_JOINED} from menu_item_variants v
         join menu_items i on i.item_id = v.item_id
         where v.variant_id = $1 and i.deleted_at is null`,
        [variantId],
      );
      return rows[0] ? toVariant(rows[0]) : null;
    },

    async createVariant(itemId, input) {
      try {
        const { rows } = await pool.query(
          `insert into menu_item_variants (item_id, label, price, is_available, sort_order)
           values ($1, $2, $3, $4,
             (select coalesce(max(sort_order), -1) + 1 from menu_item_variants where item_id = $1))
           returning ${VARIANT_RET}`,
          [itemId, input.label, input.price, input.isAvailable ?? true],
        );
        return toVariant(rows[0]);
      } catch (err) {
        if (isUnique(err)) throw variantLabelTaken();
        throw err;
      }
    },

    async updateVariant(variantId, patch) {
      const { sets, values } = setClause(VARIANT_FIELDS, patch);
      try {
        const { rows } = await pool.query(
          `update menu_item_variants set ${sets.join(', ')}
           where variant_id = $${values.length + 1} returning ${VARIANT_RET}`,
          [...values, variantId],
        );
        if (!rows[0]) throw variantNotFound();
        return toVariant(rows[0]);
      } catch (err) {
        if (isUnique(err)) throw variantLabelTaken();
        throw err;
      }
    },

    async deleteVariant(variantId) {
      const { rowCount } = await pool.query(
        'delete from menu_item_variants where variant_id = $1',
        [variantId],
      );
      if (!rowCount) throw variantNotFound();
    },
  };
  return store;
}
