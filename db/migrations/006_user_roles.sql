-- User roles table for role-based access control
create table if not exists public.user_roles (
  user_id text primary key,  -- Clerk userId
  role text not null check (role in ('admin', 'carrier')),
  created_at timestamptz not null default now()
);

-- Index for role-based queries
create index if not exists idx_user_roles_role on public.user_roles(role);

-- Add published column to loads table if not exists (for admin management)
alter table public.loads add column if not exists published boolean not null default false;

-- Index for published loads filtering
create index if not exists idx_loads_published on public.loads(published);
