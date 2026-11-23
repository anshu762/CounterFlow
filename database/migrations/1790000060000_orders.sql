-- Up Migration
-- Orders. Money is numeric(10,2). business_date is computed in Asia/Kolkata by the app.
create table orders (
  order_id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers (customer_id) on delete restrict,
  business_date date not null,
  token_no integer not null check (token_no > 0),
  bill_no bigint not null check (bill_no > 0),
  status text not null default 'placed'
    check (status in ('placed', 'accepted', 'preparing', 'ready', 'completed', 'cancelled')),
  subtotal numeric(10,2) not null check (subtotal >= 0),
  gst_total numeric(10,2) not null check (gst_total >= 0),
  grand_total numeric(10,2) not null check (grand_total >= 0),
  prices_include_gst boolean not null default false,
  eta_minutes integer not null check (eta_minutes >= 0),
  estimated_ready_at timestamptz not null,
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'paid')),
  paid_at timestamptz,
  paid_by uuid references admin_users (user_id) on delete restrict,
  cancel_reason text
    check (cancel_reason is null or char_length(btrim(cancel_reason)) between 1 and 200),
  cancelled_by text check (cancelled_by is null or cancelled_by in ('customer', 'admin', 'system')),
  idempotency_key text
    check (idempotency_key is null or char_length(idempotency_key) between 8 and 100),
  placed_at timestamptz not null default now(),
  accepted_at timestamptz,
  preparing_at timestamptz,
  ready_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_total_matches check (grand_total = subtotal + gst_total),
  constraint orders_paid_consistent check ((payment_status = 'paid') = (paid_at is not null)),
  constraint orders_cancelled_consistent check ((status = 'cancelled') = (cancelled_at is not null)),
  constraint orders_token_per_day_uq unique (business_date, token_no),
  constraint orders_bill_no_uq unique (bill_no),
  constraint orders_idempotency_uq unique (customer_id, idempotency_key),
  constraint orders_order_customer_uq unique (order_id, customer_id)
);
create index orders_customer_idx on orders (customer_id, placed_at desc);
create index orders_day_status_idx on orders (business_date, status);
create index orders_open_idx on orders (placed_at)
  where status in ('placed', 'accepted', 'preparing');
create trigger orders_set_updated_at
  before update on orders
  for each row execute function set_updated_at();

-- Lines snapshot the menu at order time so later menu edits never change old bills.
create table order_items (
  order_item_id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (order_id) on delete cascade,
  item_id uuid not null references menu_items (item_id) on delete restrict,
  variant_id uuid references menu_item_variants (variant_id) on delete set null,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  variant_label text check (variant_label is null or char_length(variant_label) between 1 and 40),
  unit_price numeric(10,2) not null check (unit_price > 0),
  gst_percent numeric(5,2) not null check (gst_percent between 0 and 28),
  is_veg boolean not null,
  prep_time_minutes integer not null check (prep_time_minutes > 0),
  quantity integer not null check (quantity between 1 and 50),
  line_subtotal numeric(10,2) not null check (line_subtotal >= 0),
  line_gst numeric(10,2) not null check (line_gst >= 0),
  line_total numeric(10,2) not null check (line_total >= 0),
  note text check (note is null or char_length(note) between 1 and 140),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint order_items_total_matches check (line_total = line_subtotal + line_gst)
);
create index order_items_order_idx on order_items (order_id);
create index order_items_item_idx on order_items (item_id);

-- Every status change is recorded. Rows are never updated.
create table order_status_history (
  history_id bigint generated always as identity primary key,
  order_id uuid not null references orders (order_id) on delete cascade,
  from_status text
    check (from_status is null
      or from_status in ('placed', 'accepted', 'preparing', 'ready', 'completed', 'cancelled')),
  to_status text not null
    check (to_status in ('placed', 'accepted', 'preparing', 'ready', 'completed', 'cancelled')),
  actor_type text not null check (actor_type in ('customer', 'admin', 'system')),
  actor_id uuid,
  reason text check (reason is null or char_length(btrim(reason)) between 1 and 200),
  created_at timestamptz not null default now(),
  constraint order_status_history_changed check (from_status is null or from_status <> to_status)
);
create index order_status_history_order_idx on order_status_history (order_id, history_id);

-- One feedback per order. The pair FK makes sure it comes from the customer who placed the order.
create table feedback (
  feedback_id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique,
  customer_id uuid not null,
  rating smallint not null check (rating between 1 and 5),
  category text not null check (category in ('food', 'service', 'wait_time', 'billing', 'other')),
  comment text check (comment is null or char_length(btrim(comment)) between 1 and 300),
  created_at timestamptz not null default now(),
  constraint feedback_order_customer_fk
    foreign key (order_id, customer_id)
    references orders (order_id, customer_id) on delete cascade
);
create index feedback_created_idx on feedback (created_at desc);
create index feedback_rating_idx on feedback (rating);

-- Down Migration
drop table if exists feedback;
drop table if exists order_status_history;
drop table if exists order_items;
drop table if exists orders;