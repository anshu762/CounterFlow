-- Up Migration

create table menu_categories (
  category_id uuid primary key default gen_random_uuid(),
  group_name text check (group_name is null or char_length(group_name) between 1 and 60),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  description text check (description is null or char_length(description) <= 300),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index menu_categories_name_uidx on menu_categories (lower(name));
create index menu_categories_order_idx on menu_categories (sort_order);

create trigger menu_categories_set_updated_at
  before update on menu_categories
  for each row execute function set_updated_at();

create table menu_items (
  item_id uuid primary key default gen_random_uuid(),
  category_id uuid not null references menu_categories (category_id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  description text check (description is null or char_length(description) <= 500),
  price numeric(10,2) not null check (price > 0),   -- lowest variant price if variants exist
  gst_percent numeric(5,2) not null default 5 check (gst_percent between 0 and 28),
  prep_time_minutes integer not null default 10 check (prep_time_minutes > 0),
  is_veg boolean not null default true,
  is_available boolean not null default true,        -- "sold out" toggle
  badge text check (badge is null or badge in ('must_try', 'house_special', 'signature', 'speciality')),
  image_url text,
  image_public_id text,                              -- Cloudinary id (own uploads only)
  image_credit text,                                 -- e.g. "Photo by X on Pexels"
  sort_order integer not null default 0,
  deleted_at timestamptz,                            -- soft delete
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index menu_items_name_uidx
  on menu_items (category_id, lower(name)) where deleted_at is null;
create index menu_items_list_idx on menu_items (category_id, sort_order);
create index menu_items_name_trgm_idx on menu_items using gin (name gin_trgm_ops);

create trigger menu_items_set_updated_at
  before update on menu_items
  for each row execute function set_updated_at();

-- Sizes such as Small/Medium/Large. An item with variants makes the customer pick one.
create table menu_item_variants (
  variant_id uuid primary key default gen_random_uuid(),
  item_id uuid not null references menu_items (item_id) on delete cascade,
  label text not null check (char_length(btrim(label)) between 1 and 30),
  price numeric(10,2) not null check (price > 0),
  is_available boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index menu_item_variants_label_uidx on menu_item_variants (item_id, lower(label));

create trigger menu_item_variants_set_updated_at
  before update on menu_item_variants
  for each row execute function set_updated_at();

-- Down Migration

drop table if exists menu_item_variants;
drop table if exists menu_items;
drop table if exists menu_categories;