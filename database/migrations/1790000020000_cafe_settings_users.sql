-- Up Migration

-- Exactly one row can ever exist: id is always true and is the primary key.
create table cafe_settings (
  id boolean primary key default true check (id),
  name text not null check (char_length(btrim(name)) between 2 and 100),
  phone text,
  email text,
  address text,
  city text,
  state text,
  gstin text
    check (gstin is null or gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'),
  default_gst_percent numeric(5,2) not null default 5
    check (default_gst_percent between 0 and 28),
  prices_include_gst boolean not null default false,
  avg_prep_slot_minutes integer not null default 5 check (avg_prep_slot_minutes > 0),
  accepting_orders boolean not null default true,
  business_hours jsonb not null default '{}'::jsonb,
  logo_url text,
  theme jsonb,                         -- cafe-wide theme: {themeId, custom}
  bill_prefix text not null default 'BHK' check (bill_prefix ~ '^[A-Z0-9]{1,6}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into cafe_settings (name, city, state, bill_prefix)
values ('Brick House Kitchen', 'Amritsar', 'Punjab', 'BHK');

create trigger cafe_settings_set_updated_at
  before update on cafe_settings
  for each row execute function set_updated_at();

create table admin_users (
  user_id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 100),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  password_hash text not null,
  role text not null check (role in ('owner', 'staff')),
  is_active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index admin_users_email_uidx on admin_users (lower(email));

create trigger admin_users_set_updated_at
  before update on admin_users
  for each row execute function set_updated_at();

create table customers (
  customer_id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 100),
  phone text not null unique check (phone ~ '^\+?[0-9]{10,15}$'),
  email text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  password_hash text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index customers_email_uidx on customers (lower(email)) where email is not null;

create trigger customers_set_updated_at
  before update on customers
  for each row execute function set_updated_at();

-- Down Migration

drop table if exists customers;
drop table if exists admin_users;
drop table if exists cafe_settings;