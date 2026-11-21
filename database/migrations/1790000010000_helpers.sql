-- Up Migration

-- Keeps updated_at correct on every UPDATE.
-- clock_timestamp() (not now()) so it changes even inside one transaction.
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end
$$;

-- Down Migration

drop function if exists set_updated_at();