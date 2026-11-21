/* global process, console, __dirname, fetch, setTimeout, clearTimeout, Buffer, URL */
'use strict';
// Usage:
//   node database/scripts/seed-menu.cjs --check   (no database; validates the data and prints counts)
//   npm run db:menu:seed                          (inserts; safe to re-run, never overwrites edits)
const categories = require('../seeds/menu-data.cjs');

const BADGES = new Set(['must_try', 'house_special', 'signature', 'speciality']);
const CHECK_ONLY = process.argv.includes('--check');

function normalise() {
  const problems = [];
  const catNames = new Set();

  const out = categories.map((cat, ci) => {
    const ckey = cat.name.toLowerCase();
    if (catNames.has(ckey)) problems.push(`duplicate category "${cat.name}"`);
    catNames.add(ckey);
    if (!(cat.prep > 0)) problems.push(`${cat.name}: prep must be > 0`);

    const seen = new Set();
    const items = cat.items.flat().map((it, ii) => {
      const where = `${cat.name} / ${it.name}`;
      const key = it.name.toLowerCase();
      if (seen.has(key)) problems.push(`duplicate item: ${where}`);
      seen.add(key);

      const variants =
        typeof it.price === 'object'
          ? Object.entries(it.price).map(([label, price], vi) => ({
              label,
              price,
              sort: (vi + 1) * 10,
            }))
          : [];
      const price = variants.length ? Math.min(...variants.map((x) => x.price)) : it.price;

      if (!(price > 0)) problems.push(`bad price: ${where}`);
      if (it.name.length > 100) problems.push(`name too long: ${where}`);
      if (it.desc && it.desc.length > 500) problems.push(`description too long: ${where}`);
      if (it.badge && !BADGES.has(it.badge)) problems.push(`bad badge: ${where}`);

      return {
        name: it.name.trim(),
        description: it.desc || null,
        price,
        prep: it.prep || cat.prep,
        isVeg: it.veg,
        badge: it.badge || null,
        sort: (ii + 1) * 10,
        variants,
      };
    });

    return {
      group: cat.group,
      name: cat.name,
      description: cat.description || null,
      sort: (ci + 1) * 10,
      items,
    };
  });

  return { out, problems };
}

function printSummary(out) {
  let total = 0;
  let veg = 0;
  let variants = 0;
  for (const c of out) {
    const v = c.items.filter((i) => i.isVeg).length;
    total += c.items.length;
    veg += v;
    variants += c.items.reduce((s, i) => s + i.variants.length, 0);
    console.log(
      `  ${c.group.padEnd(22)} ${c.name.padEnd(28)} ${String(c.items.length).padStart(3)} items (${v} veg)`,
    );
  }
  console.log(
    `\n${out.length} categories, ${total} items (${veg} veg, ${total - veg} non-veg), ${variants} size variants`,
  );
}

async function main() {
  const { out, problems } = normalise();
  if (problems.length) {
    console.error('Menu data has problems:\n - ' + problems.join('\n - '));
    process.exit(1);
  }
  printSummary(out);
  if (CHECK_ONLY) {
    console.log('\nData check passed (nothing written).');
    return;
  }

  const { Client } = require('pg');
  const url = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL;
  if (!url) {
    console.error('Set DATABASE_URL_DIRECT first.');
    process.exit(1);
  }
  const client = new Client({ connectionString: url });
  await client.connect();

  let inserted = 0;
  let skipped = 0;
  try {
    await client.query('BEGIN');
    const gst = Number(
      (await client.query('select default_gst_percent from cafe_settings')).rows[0]
        .default_gst_percent,
    );

    for (const c of out) {
      await client.query(
        `insert into menu_categories (group_name, name, description, sort_order)
         values ($1, $2, $3, $4) on conflict ((lower(name))) do nothing`,
        [c.group, c.name, c.description, c.sort],
      );
      const categoryId = (
        await client.query(
          'select category_id from menu_categories where lower(name) = lower($1)',
          [c.name],
        )
      ).rows[0].category_id;

      const res = await client.query(
        `insert into menu_items (category_id, name, description, price, gst_percent, prep_time_minutes, is_veg, badge, sort_order)
         select $1, x.name, x.description, x.price, $2, x.prep, x.is_veg, x.badge, x.sort
         from unnest($3::text[], $4::text[], $5::numeric[], $6::int[], $7::boolean[], $8::text[], $9::int[])
              as x(name, description, price, prep, is_veg, badge, sort)
         on conflict (category_id, (lower(name))) where deleted_at is null do nothing
         returning item_id, name`,
        [
          categoryId,
          gst,
          c.items.map((i) => i.name),
          c.items.map((i) => i.description),
          c.items.map((i) => i.price),
          c.items.map((i) => i.prep),
          c.items.map((i) => i.isVeg),
          c.items.map((i) => i.badge),
          c.items.map((i) => i.sort),
        ],
      );
      inserted += res.rowCount;
      skipped += c.items.length - res.rowCount;

      const idByName = new Map(res.rows.map((r) => [r.name.toLowerCase(), r.item_id]));
      const vi = [];
      const vl = [];
      const vp = [];
      const vs = [];
      for (const it of c.items) {
        const id = idByName.get(it.name.toLowerCase());
        if (!id) continue; // already existed: leave its variants alone
        for (const x of it.variants) {
          vi.push(id);
          vl.push(x.label);
          vp.push(x.price);
          vs.push(x.sort);
        }
      }
      if (vi.length) {
        await client.query(
          `insert into menu_item_variants (item_id, label, price, sort_order)
           select * from unnest($1::uuid[], $2::text[], $3::numeric[], $4::int[])`,
          [vi, vl, vp, vs],
        );
      }
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Seed failed, nothing was saved:', e.message);
    process.exit(1);
  } finally {
    await client.end();
  }
  console.log(`\nInserted ${inserted} items, skipped ${skipped} that already existed.`);
}

main();
