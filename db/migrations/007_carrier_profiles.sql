-- Carrier profiles table for additional carrier information
create table if not exists public.carrier_profiles (
  user_id text primary key references user_roles(user_id) on delete cascade,
  mc_number text,
  dot_number text,
  phone text,
  dispatch_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for carrier profile lookups
create index if not exists idx_carrier_profiles_mc on public.carrier_profiles(mc_number);
create index if not exists idx_carrier_profiles_dot on public.carrier_profiles(dot_number);
