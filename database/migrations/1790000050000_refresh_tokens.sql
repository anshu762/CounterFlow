-- Up Migration
create table refresh_tokens (
  token_id      uuid primary key default gen_random_uuid(),
  family_id     uuid not null,
  admin_user_id uuid references admin_users(user_id) on delete cascade,
  customer_id   uuid references customers(customer_id) on delete cascade,
  token_hash    text not null unique,
  expires_at    timestamptz not null,
  revoked_at    timestamptz,
  replaced_by   uuid references refresh_tokens(token_id) on delete set null,
  ip            text,
  user_agent    text,
  created_at    timestamptz not null default now(),
  constraint refresh_tokens_one_owner check (
    (admin_user_id is not null)::int + (customer_id is not null)::int = 1
  )
);

create index refresh_tokens_family_idx on refresh_tokens (family_id);
create index refresh_tokens_admin_idx on refresh_tokens (admin_user_id) where admin_user_id is not null;
create index refresh_tokens_customer_idx on refresh_tokens (customer_id) where customer_id is not null;
create index refresh_tokens_expires_idx on refresh_tokens (expires_at);

-- Down Migration
drop table if exists refresh_tokens;