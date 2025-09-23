create table if not exists public.load_offers (
  id bigserial primary key,
  load_rr text not null references public.loads(rr_number) on delete cascade,
  clerk_user_id text not null,
  price numeric,
  notes text,
  status text not null default 'pending',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists load_offers_rr_idx on public.load_offers(load_rr);
create index if not exists loads_published_idx on public.loads(published);
