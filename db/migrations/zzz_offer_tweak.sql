-- Ensure required columns exist
alter table if exists public.load_offers
  add column if not exists notes text,
  add column if not exists status text default 'PENDING';
