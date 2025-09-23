alter table public.loads
  add column if not exists published boolean not null default false;

-- (Nice to have) an index for quick filtering:
create index if not exists idx_loads_published on public.loads (published);
