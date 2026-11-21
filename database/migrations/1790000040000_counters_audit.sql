-- Up Migration

-- Sequential bill number (never resets). One row only.
create table bill_counter (
  id boolean primary key default true check (id),
  last_bill_no bigint not null default 0
);
insert into bill_counter default values;

-- Token number per business day (resets daily).
create table token_counters (
  business_date date primary key,
  last_token_no integer not null default 0
);

-- Call these INSIDE the same transaction that inserts the order.
-- A rollback gives the number back, so there are no gaps.
create or replace function next_bill_no() returns bigint
language plpgsql as $$
declare
  v bigint;
begin
  update bill_counter set last_bill_no = last_bill_no + 1 returning last_bill_no into v;
  return v;
end
$$;

-- business_date is passed in explicitly (computed in Asia/Kolkata by the app).
create or replace function next_token_no(p_business_date date) returns integer
language plpgsql as $$
declare
  v integer;
begin
  insert into token_counters (business_date, last_token_no) values (p_business_date, 1)
  on conflict (business_date)
  do update set last_token_no = token_counters.last_token_no + 1
  returning last_token_no into v;
  return v;
end
$$;

create table audit_log (
  audit_id bigint generated always as identity primary key,
  actor_type text not null check (actor_type in ('admin', 'customer', 'system')),
  actor_id uuid,
  action text not null check (char_length(action) between 1 and 80),
  entity_type text,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  ip text,
  created_at timestamptz not null default now()
);

create index audit_log_created_idx on audit_log (created_at desc);
create index audit_log_entity_idx on audit_log (entity_type, entity_id);

-- Down Migration

drop table if exists audit_log;
drop function if exists next_token_no(date);
drop function if exists next_bill_no();
drop table if exists token_counters;
drop table if exists bill_counter;
