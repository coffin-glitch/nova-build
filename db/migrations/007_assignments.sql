create table if not exists public.assignments (
  id bigserial primary key,
  load_rr text references public.loads(rr_number) on delete set null,
  clerk_user_id text not null,
  accepted_price numeric,
  created_at timestamptz default now()
);
create index if not exists assignments_rr_idx on public.assignments(load_rr);
