/* global process, URL console, __dirname */
// Checks the 2A order tables on the dev database. Everything is rolled back.
//   node database/scripts/verify-orders.cjs

const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');
const { Client } = require('pg');

let passed = 0;
let failed = 0;

function record(name, ok, detail = '') {
  if (ok) {
    passed += 1;
    console.log(`PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`FAIL  ${name}${detail ? ` (${detail})` : ''}`);
  }
}

async function step(client, name, fn) {
  await client.query('savepoint sp');
  try {
    const value = await fn();
    await client.query('release savepoint sp');
    record(name, true);
    return value;
  } catch (err) {
    await client.query('rollback to savepoint sp');
    await client.query('release savepoint sp');
    record(name, false, err.message);
    return null;
  }
}

async function rejects(client, name, code, fn) {
  await client.query('savepoint sp');
  let got = 'no error';
  try {
    await fn();
  } catch (err) {
    got = err.code ?? err.message;
  }
  await client.query('rollback to savepoint sp');
  await client.query('release savepoint sp');
  record(name, got === code, `expected ${code}, got ${got}`);
}

async function insert(client, table, row) {
  const cols = Object.keys(row);
  const names = cols.map((c) => `"${c}"`).join(', ');
  const marks = cols.map((_, i) => `$${i + 1}`).join(', ');
  const sql = `insert into ${table} (${names}) values (${marks}) returning *`;
  const result = await client.query(
    sql,
    cols.map((c) => row[c]),
  );
  return result.rows[0];
}

let seq = 0;
function orderRow(customerId, extra = {}) {
  seq += 1;
  return {
    customer_id: customerId,
    business_date: '2000-01-01',
    token_no: 100 + seq,
    bill_no: 900000000 + seq,
    subtotal: 100,
    gst_total: 5,
    grand_total: 105,
    eta_minutes: 10,
    estimated_ready_at: new Date(),
    ...extra,
  };
}

function lineRow(orderId, itemId, extra = {}) {
  return {
    order_id: orderId,
    item_id: itemId,
    name: 'Test Item',
    unit_price: 100,
    gst_percent: 5,
    is_veg: true,
    prep_time_minutes: 10,
    quantity: 2,
    line_subtotal: 200,
    line_gst: 10,
    line_total: 210,
    ...extra,
  };
}

async function count(client, sql, params) {
  const { rows } = await client.query(sql, params);
  return rows[0].n;
}

async function main() {
  const envPath = path.join(__dirname, '..', '..', 'backend', '.env');
  const url = dotenv.parse(fs.readFileSync(envPath)).DATABASE_URL_DIRECT;
  if (!url) throw new Error('DATABASE_URL_DIRECT is missing in backend/.env');

  const client = new Client({ connectionString: url });
  await client.connect();
  const parsed = new URL(url);
  console.log(`Database: ${parsed.hostname}${parsed.pathname} (everything is rolled back)\n`);

  try {
    await client.query('begin');

    const picked = await client.query(
      'select item_id from menu_items where deleted_at is null limit 1',
    );
    if (picked.rows.length === 0) throw new Error('No menu items in this database');
    const itemId = picked.rows[0].item_id;

    const cust = await insert(client, 'customers', {
      name: 'Verify A',
      phone: '+919000000098',
      password_hash: 'x',
    });
    const other = await insert(client, 'customers', {
      name: 'Verify B',
      phone: '+919000000099',
      password_hash: 'x',
    });

    // ---- orders
    const bill = (await client.query('select next_bill_no() as n')).rows[0].n;
    const token = (await client.query("select next_token_no('2000-01-01') as n")).rows[0].n;
    const A = await step(client, 'order insert with counter numbers', () =>
      insert(client, 'orders', orderRow(cust.customer_id, { bill_no: bill, token_no: token })),
    );
    if (!A) throw new Error('Base order failed, stopping');
    record(
      'new order defaults to placed and unpaid',
      A.status === 'placed' && A.payment_status === 'unpaid',
    );

    await rejects(client, 'unknown status is rejected', '23514', () =>
      insert(client, 'orders', orderRow(cust.customer_id, { status: 'done' })),
    );
    await rejects(client, 'same token on the same day is rejected', '23505', () =>
      insert(client, 'orders', orderRow(cust.customer_id, { token_no: A.token_no })),
    );
    const B = await step(client, 'same token on another day is allowed', () =>
      insert(
        client,
        'orders',
        orderRow(cust.customer_id, { business_date: '2000-01-02', token_no: A.token_no }),
      ),
    );
    await rejects(client, 'duplicate bill number is rejected', '23505', () =>
      insert(client, 'orders', orderRow(cust.customer_id, { bill_no: A.bill_no })),
    );
    await rejects(client, 'total that does not add up is rejected', '23514', () =>
      insert(client, 'orders', orderRow(cust.customer_id, { grand_total: 999 })),
    );
    await rejects(client, 'negative amount is rejected', '23514', () =>
      insert(client, 'orders', orderRow(cust.customer_id, { subtotal: -1, grand_total: 4 })),
    );
    await rejects(client, 'paid without paid_at is rejected', '23514', () =>
      insert(client, 'orders', orderRow(cust.customer_id, { payment_status: 'paid' })),
    );
    await step(client, 'paid with paid_at is allowed', () =>
      insert(
        client,
        'orders',
        orderRow(cust.customer_id, { payment_status: 'paid', paid_at: new Date() }),
      ),
    );
    await rejects(client, 'cancelled without cancelled_at is rejected', '23514', () =>
      insert(client, 'orders', orderRow(cust.customer_id, { status: 'cancelled' })),
    );
    await step(client, 'cancelled with cancelled_at is allowed', () =>
      insert(
        client,
        'orders',
        orderRow(cust.customer_id, {
          status: 'cancelled',
          cancelled_at: new Date(),
          cancelled_by: 'customer',
          cancel_reason: 'Changed my mind',
        }),
      ),
    );
    await rejects(client, 'unknown cancelled_by is rejected', '23514', () =>
      insert(client, 'orders', orderRow(cust.customer_id, { cancelled_by: 'owner' })),
    );
    await step(client, 'first idempotency key is allowed', () =>
      insert(client, 'orders', orderRow(cust.customer_id, { idempotency_key: 'key-12345678' })),
    );
    await rejects(client, 'same idempotency key for the same customer is rejected', '23505', () =>
      insert(client, 'orders', orderRow(cust.customer_id, { idempotency_key: 'key-12345678' })),
    );
    await step(client, 'same idempotency key for another customer is allowed', () =>
      insert(client, 'orders', orderRow(other.customer_id, { idempotency_key: 'key-12345678' })),
    );
    await rejects(client, 'too short idempotency key is rejected', '23514', () =>
      insert(client, 'orders', orderRow(cust.customer_id, { idempotency_key: 'abc' })),
    );

    // ---- order items
    await step(client, 'order line insert', () =>
      insert(client, 'order_items', lineRow(A.order_id, itemId)),
    );
    await rejects(client, 'quantity 0 is rejected', '23514', () =>
      insert(client, 'order_items', lineRow(A.order_id, itemId, { quantity: 0 })),
    );
    await rejects(client, 'quantity 51 is rejected', '23514', () =>
      insert(client, 'order_items', lineRow(A.order_id, itemId, { quantity: 51 })),
    );
    await rejects(client, 'note of 141 characters is rejected', '23514', () =>
      insert(client, 'order_items', lineRow(A.order_id, itemId, { note: 'x'.repeat(141) })),
    );
    await step(client, 'note of 140 characters is allowed', () =>
      insert(client, 'order_items', lineRow(A.order_id, itemId, { note: 'x'.repeat(140) })),
    );
    await rejects(client, 'line total that does not add up is rejected', '23514', () =>
      insert(client, 'order_items', lineRow(A.order_id, itemId, { line_total: 1 })),
    );
    await rejects(client, 'unit price 0 is rejected', '23514', () =>
      insert(client, 'order_items', lineRow(A.order_id, itemId, { unit_price: 0 })),
    );
    await rejects(client, 'GST above 28 is rejected', '23514', () =>
      insert(client, 'order_items', lineRow(A.order_id, itemId, { gst_percent: 29 })),
    );
    await rejects(client, 'unknown menu item is rejected', '23503', () =>
      insert(client, 'order_items', lineRow(A.order_id, '00000000-0000-4000-8000-000000000000')),
    );
    await rejects(client, 'deleting an ordered menu item is blocked', '23001', () =>
      client.query('delete from menu_items where item_id = $1', [itemId]),
    );

    const variant = await insert(client, 'menu_item_variants', {
      item_id: itemId,
      label: 'QA Size',
      price: 10,
    });
    const sized = await insert(
      client,
      'order_items',
      lineRow(A.order_id, itemId, { variant_id: variant.variant_id, variant_label: 'QA Size' }),
    );
    await client.query('delete from menu_item_variants where variant_id = $1', [
      variant.variant_id,
    ]);
    const afterDelete = (
      await client.query(
        'select variant_id, variant_label from order_items where order_item_id = $1',
        [sized.order_item_id],
      )
    ).rows[0];
    record(
      'deleting a size keeps the order line and its label',
      afterDelete.variant_id === null && afterDelete.variant_label === 'QA Size',
    );

    // ---- status history
    const H = (extra) =>
      insert(client, 'order_status_history', {
        order_id: A.order_id,
        to_status: 'placed',
        actor_type: 'customer',
        actor_id: cust.customer_id,
        ...extra,
      });
    await step(client, 'history row with no from-status is allowed', () => H({}));
    await step(client, 'history placed to accepted is allowed', () =>
      H({ from_status: 'placed', to_status: 'accepted', actor_type: 'admin', actor_id: null }),
    );
    await rejects(client, 'history with the same from and to is rejected', '23514', () =>
      H({ from_status: 'placed', to_status: 'placed' }),
    );
    await rejects(client, 'history with an unknown actor is rejected', '23514', () =>
      H({ actor_type: 'staff' }),
    );
    await rejects(client, 'history with an unknown status is rejected', '23514', () =>
      H({ to_status: 'done' }),
    );

    // ---- feedback
    const F = (orderId, customerId, extra) =>
      insert(client, 'feedback', {
        order_id: orderId,
        customer_id: customerId,
        rating: 5,
        category: 'food',
        ...extra,
      });
    await step(client, 'feedback from the order owner is allowed', () =>
      F(A.order_id, cust.customer_id, { comment: 'Great' }),
    );
    await rejects(client, 'rating 0 is rejected', '23514', () =>
      F(B.order_id, cust.customer_id, { rating: 0 }),
    );
    await rejects(client, 'rating 6 is rejected', '23514', () =>
      F(B.order_id, cust.customer_id, { rating: 6 }),
    );
    await rejects(client, 'unknown category is rejected', '23514', () =>
      F(B.order_id, cust.customer_id, { category: 'taste' }),
    );
    await rejects(client, 'comment of 301 characters is rejected', '23514', () =>
      F(B.order_id, cust.customer_id, { comment: 'x'.repeat(301) }),
    );
    await rejects(client, 'feedback from another customer is rejected', '23503', () =>
      F(B.order_id, other.customer_id, {}),
    );
    await step(client, 'comment of 300 characters is allowed', () =>
      F(B.order_id, cust.customer_id, { comment: 'x'.repeat(300), category: 'wait_time' }),
    );
    await rejects(client, 'second feedback for the same order is rejected', '23505', () =>
      F(A.order_id, cust.customer_id, {}),
    );

    // ---- delete rules
    await rejects(client, 'deleting a customer who has orders is blocked', '23001', () =>
      client.query('delete from customers where customer_id = $1', [cust.customer_id]),
    );
    await client.query('delete from orders where order_id = $1', [A.order_id]);
    const left =
      (await count(client, 'select count(*)::int as n from order_items where order_id = $1', [
        A.order_id,
      ])) +
      (await count(
        client,
        'select count(*)::int as n from order_status_history where order_id = $1',
        [A.order_id],
      )) +
      (await count(client, 'select count(*)::int as n from feedback where order_id = $1', [
        A.order_id,
      ]));
    record('deleting an order removes its lines, history and feedback', left === 0, `left ${left}`);
  } finally {
    await client.query('rollback').catch(() => {});
    await client.end().catch(() => {});
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(`Verify failed: ${err.message}`);
  process.exitCode = 1;
});
