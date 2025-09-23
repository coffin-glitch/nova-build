-- Raw “append-only” capture for auditing/debug
create table if not exists public.eax_loads_raw (
  id                  bigserial primary key,
  rr_number           text not null,
  tm_number           text,
  status_code         text,
  pickup_date         date,
  pickup_window       text,
  delivery_date       date,
  delivery_window     text,
  revenue             numeric,
  purchase            numeric,
  net                 numeric,
  margin              numeric,
  equipment           text,
  customer_name       text,
  customer_ref        text,
  driver_name         text,
  total_miles         integer,
  origin_city         text,
  origin_state        text,
  destination_city    text,
  destination_state   text,
  vendor_name         text,
  dispatcher_name     text,
  created_at          timestamptz default now()
);

-- Current-view table with upserts keyed by rr_number
create table if not exists public.loads (
  rr_number           text primary key,
  tm_number           text,
  status_code         text,
  pickup_date         date,
  pickup_window       text,
  delivery_date       date,
  delivery_window     text,
  revenue             numeric,
  purchase            numeric,
  net                 numeric,
  margin              numeric,
  equipment           text,
  customer_name       text,
  customer_ref        text,
  driver_name         text,
  total_miles         integer,
  origin_city         text,
  origin_state        text,
  destination_city    text,
  destination_state   text,
  vendor_name         text,
  dispatcher_name     text,
  updated_at          timestamptz default now()
);

-- Helpful indexes for queries / UI filtering
create index if not exists idx_loads_pickup_date        on public.loads (pickup_date);
create index if not exists idx_loads_status_code        on public.loads (status_code);
create index if not exists idx_loads_origin_state       on public.loads (origin_state);
create index if not exists idx_loads_destination_state  on public.loads (destination_state);

-- Optional: if you’ll often search by customer/vendor
create index if not exists idx_loads_customer_name      on public.loads (customer_name);
create index if not exists idx_loads_vendor_name        on public.loads (vendor_name);
