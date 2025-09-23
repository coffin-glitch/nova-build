alter table public.telegram_bids
  add column if not exists published boolean default true;
create index if not exists telegram_bids_published_idx on public.telegram_bids(published);
create index if not exists telegram_bids_received_idx on public.telegram_bids(received_at desc);
