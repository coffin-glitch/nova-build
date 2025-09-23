create index if not exists loads_origin_idx on public.loads using gin ((origin_city || ', ' || origin_state) gin_trgm_ops);
create index if not exists loads_dest_idx   on public.loads using gin ((destination_city || ', ' || destination_state) gin_trgm_ops);
create index if not exists loads_eqp_idx    on public.loads using gin (equipment gin_trgm_ops);
create index if not exists loads_pickup_idx on public.loads (pickup_date);
-- (ensure pg_trgm extension installed on Supabase project)
