create table if not exists public.user_roles (
  clerk_user_id text primary key,
  role text not null check (role in ('admin','carrier')),
  created_at timestamptz default now()
);

create index if not exists idx_user_roles_role on public.user_roles(role);
