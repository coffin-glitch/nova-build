-- Create table for Telegram bids
create table if not exists public.telegram_bids (
  id bigserial primary key,
  bid_number text not null,
  distance_miles numeric,
  pickup_timestamp timestamptz,
  delivery_timestamp timestamptz,
  stops jsonb,
  tag text,
  source_channel text not null,
  forwarded_to text,
  received_at timestamptz default now(),
  expires_at timestamptz,
  unique (bid_number)
);

