'use strict';
const { Client } = require('pg');

const url = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL;
if (!url) {
  console.error('Set DATABASE_URL_DIRECT (or DATABASE_URL) first.');
  process.exit(1);
}

const TABLES = [
  'cafe_settings',
  'admin_users',
  'customers',
  'menu_categories',
  'menu_items',
  'menu_item_variants',
  'bill_counter',
  'token_counters',
  'audit_log',
];

let passed = 0;
let failed = 0;
const ok = (name) => {
  passed += 1;
  console.log(`  PASS  ${name}`);
};
const bad = (name, detail) => {
  failed += 1;
  console.log(`  FAIL  ${name}  ->  ${detail}`);
};
const check = (name, cond, detail = 'condition was false') => (cond ? ok(name) : bad(name, detail));

// Runs a statement that MUST fail with a specific Postgres error code.
async function expectError(client, name, code, sql, params = []) {
  await client.query('SAVEPOINT sp');
  try {
    await client.query(sql, params);
    bad(name, 'expected an error, but the statement succeeded');
  } catch (e) {
    if (e.code === code) ok(name);
    else bad(name, `expected ${code}, got ${e.code} (${e.message})`);
  }
  await client.query('ROLLBACK TO SAVEPOINT sp');
}

async function main() {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query('BEGIN');

    // ---- structure ----
    const t = await client.query(
      "select table_name from information_schema.tables where table_schema = 'public'",
    );
    const existing = new Set(t.rows.map((r) => r.table_name));
    for (const name of TABLES) check(`table ${name} exists`, existing.has(name));
    check('old multi-cafe table "tenants" is gone', !existing.has('tenants'));

    const m = await client.query('select name from pgmigrations');
    const names = m.rows.map((r) => r.name).join(',');
    for (const part of ['helpers', 'cafe_settings_users', 'menu', 'counters_audit']) {
      check(`migration "${part}" recorded`, names.includes(part));
    }

    // ---- cafe settings (single row) ----
    const cnt = await client.query('select count(*)::int as n from cafe_settings');
    check('cafe_settings has exactly one row', cnt.rows[0].n === 1);
    await expectError(
      client,
      'cafe: a second settings row is rejected',
      '23505',
      "insert into cafe_settings (name) values ('Second Cafe')",
    );
    await expectError(
      client,
      'cafe: GST above 28 rejected',
      '23514',
      'update cafe_settings set default_gst_percent = 29',
    );
    await expectError(
      client,
      'cafe: bad GSTIN rejected',
      '23514',
      "update cafe_settings set gstin = 'NOTAGSTIN'",
    );
    await expectError(
      client,
      'cafe: bad bill prefix rejected',
      '23514',
      "update cafe_settings set bill_prefix = 'bad prefix'",
    );

    // ---- admin users ----
    await client.query(
      "insert into admin_users (name, email, password_hash, role) values ('Owner One', 'Owner@Test.com', 'x', 'owner')",
    );
    await expectError(
      client,
      'admin: email unique, case-insensitive',
      '23505',
      "insert into admin_users (name, email, password_hash, role) values ('Other Owner', 'owner@test.com', 'x', 'owner')",
    );
    await expectError(
      client,
      'admin: role must be owner or staff',
      '23514',
      "insert into admin_users (name, email, password_hash, role) values ('Some Admin', 'a2@test.com', 'x', 'admin')",
    );

    // ---- customers ----
    await client.query(
      "insert into customers (name, phone, email, password_hash) values ('Asha Rao', '9876543210', 'Asha@Test.com', 'x')",
    );
    await expectError(
      client,
      'customer: phone unique',
      '23505',
      "insert into customers (name, phone, password_hash) values ('Asha Two', '9876543210', 'x')",
    );
    await expectError(
      client,
      'customer: email unique, case-insensitive',
      '23505',
      "insert into customers (name, phone, email, password_hash) values ('Asha Three', '9876543211', 'asha@test.com', 'x')",
    );
    await expectError(
      client,
      'customer: invalid phone rejected',
      '23514',
      "insert into customers (name, phone, password_hash) values ('Bad Phone', '12345', 'x')",
    );

    // ---- menu ----
    const cat = (
      await client.query(
        "insert into menu_categories (name, group_name) values ('Verify Coffee', 'Verify') returning category_id",
      )
    ).rows[0].category_id;
    await expectError(
      client,
      'category: name unique, case-insensitive',
      '23505',
      "insert into menu_categories (name) values ('verify coffee')",
    );

    const item = (
      await client.query(
        "insert into menu_items (category_id, name, price) values ($1, 'Latte', 120) returning item_id",
        [cat],
      )
    ).rows[0].item_id;
    await expectError(
      client,
      'item: price 0 rejected',
      '23514',
      "insert into menu_items (category_id, name, price) values ($1, 'Free', 0)",
      [cat],
    );
    await expectError(
      client,
      'item: GST 29 rejected',
      '23514',
      "insert into menu_items (category_id, name, price, gst_percent) values ($1, 'Taxed', 10, 29)",
      [cat],
    );
    await expectError(
      client,
      'item: prep time 0 rejected',
      '23514',
      "insert into menu_items (category_id, name, price, prep_time_minutes) values ($1, 'Instant', 10, 0)",
      [cat],
    );
    await expectError(
      client,
      'item: unknown badge rejected',
      '23514',
      "insert into menu_items (category_id, name, price, badge) values ($1, 'Odd', 10, 'bogus')",
      [cat],
    );
    await expectError(
      client,
      'item: duplicate name in a category rejected',
      '23505',
      "insert into menu_items (category_id, name, price) values ($1, 'latte', 99)",
      [cat],
    );
    await expectError(
      client,
      'item: unknown category rejected',
      '23503',
      "insert into menu_items (category_id, name, price) values (gen_random_uuid(), 'Lost', 10)",
    );
    await expectError(
      client,
      'category with items cannot be deleted',
      '23001',
      'delete from menu_categories where category_id = $1',
      [cat],
    );

    await client.query(
      "insert into menu_item_variants (item_id, label, price) values ($1, 'Small', 100)",
      [item],
    );
    await expectError(
      client,
      'variant: duplicate label rejected',
      '23505',
      "insert into menu_item_variants (item_id, label, price) values ($1, 'small', 110)",
      [item],
    );
    await expectError(
      client,
      'variant: price 0 rejected',
      '23514',
      "insert into menu_item_variants (item_id, label, price) values ($1, 'Large', 0)",
      [item],
    );

    await client.query('update menu_items set deleted_at = now() where item_id = $1', [item]);
    await client.query(
      "insert into menu_items (category_id, name, price) values ($1, 'Latte', 130)",
      [cat],
    );
    ok('item: name reusable after soft delete');

    await client.query('delete from menu_items where item_id = $1', [item]);
    const orphan = await client.query(
      'select count(*)::int as n from menu_item_variants where item_id = $1',
      [item],
    );
    check('variants are removed with their item', orphan.rows[0].n === 0);

    // ---- updated_at trigger ----
    await client.query(
      "update menu_categories set name = 'Verify Coffee 2' where category_id = $1",
      [cat],
    );
    const u = (
      await client.query(
        'select updated_at > created_at as moved from menu_categories where category_id = $1',
        [cat],
      )
    ).rows[0];
    check('trigger: updated_at changes on update', u.moved === true);

    // ---- counters (relative checks, so they also pass on a live database) ----
    const bill = async () => Number((await client.query('select next_bill_no() as n')).rows[0].n);
    const tok = async (d) =>
      Number((await client.query('select next_token_no($1::date) as n', [d])).rows[0].n);
    const b1 = await bill();
    const b2 = await bill();
    check('bill numbers are sequential', b2 === b1 + 1);
    check(
      'token numbers sequential within a day',
      (await tok('2030-01-01')) === 1 && (await tok('2030-01-01')) === 2,
    );
    check('token numbers reset on a new day', (await tok('2030-01-02')) === 1);

    // ---- audit log ----
    await client.query(
      "insert into audit_log (actor_type, action, entity_type, entity_id) values ('system', 'verify.schema', 'cafe', '1')",
    );
    ok('audit_log accepts a row');
    await expectError(
      client,
      'audit_log: bad actor_type rejected',
      '23514',
      "insert into audit_log (actor_type, action) values ('robot', 'x')",
    );
  } finally {
    await client.query('ROLLBACK').catch(() => {});
    await client.end();
  }

  console.log(`\n${passed} passed, ${failed} failed (all test data rolled back)`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('Verification crashed:', e.message);
  process.exit(1);
});
