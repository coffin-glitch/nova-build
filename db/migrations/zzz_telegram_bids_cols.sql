-- Ensure expected columns exist:
alter table if exists public.telegram_bids
  add column if not exists distance_miles numeric,
  add column if not exists pickup_timestamp timestamptz,
  add column if not exists delivery_timestamp timestamptz,
  add column if not exists stops jsonb,
  add column if not exists tag text,
  add column if not exists received_at timestamptz default now(),
  add column if not exists expires_at timestamptz;

-- Ensure loads unique:
do $$ begin
  if not exists (select 1 from pg_indexes where indexname='loads_rr_unique') then
    alter table public.loads add constraint loads_rr_unique unique (rr_number);
  end if;
end $$;
