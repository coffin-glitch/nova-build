-- Carrier bid offers on Telegram bids
create table if not exists public.telegram_bid_offers (
  id            bigserial primary key,
  bid_id        bigint not null references public.telegram_bids(id) on delete cascade,
  user_id       text not null,           -- Clerk userId
  amount_cents  integer not null check (amount_cents >= 0),
  note          text,
  created_at    timestamptz not null default now()
);
create index if not exists idx_tbo_bid on public.telegram_bid_offers(bid_id);
create index if not exists idx_tbo_user on public.telegram_bid_offers(user_id);

-- Offers on EAX loads (Book Loads) by carriers
create table if not exists public.load_offers (
  id            bigserial primary key,
  rr_number     text not null references public.loads(rr_number) on delete cascade,
  user_id       text not null,           -- Clerk userId
  amount_cents  integer not null check (amount_cents >= 0),
  note          text,
  created_at    timestamptz not null default now()
);
create index if not exists idx_lo_rr on public.load_offers(rr_number);
create index if not exists idx_lo_user on public.load_offers(user_id);

-- Optional: assignments (loads accepted/awarded to carriers → shows in "My Loads")
create table if not exists public.assignments (
  id            bigserial primary key,
  rr_number     text not null references public.loads(rr_number) on delete cascade,
  user_id       text not null,
  assigned_at   timestamptz not null default now(),
  status        text not null default 'assigned'  -- assigned|picked_up|delivered|cancelled
);
create index if not exists idx_asg_user on public.assignments(user_id);

-- Dedicated lanes
create table if not exists public.dedicated_lanes (
  id              bigserial primary key,
  origin_city     text,
  origin_state    text,
  destination_city text,
  destination_state text,
  equipment       text,
  rate_cents      integer,
  notes           text,
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);
create index if not exists idx_lanes_active on public.dedicated_lanes(active);
