-- Create eax_loads_raw table for storing raw EAX data before processing
CREATE TABLE IF NOT EXISTS public.eax_loads_raw (
  id SERIAL PRIMARY KEY,
  load_id text UNIQUE NOT NULL,
  origin text,
  destination text,
  pickup_date timestamptz,
  delivery_date timestamptz,
  rate decimal(10,2),
  miles integer,
  equipment_type text,
  weight decimal(10,2),
  commodity text,
  notes text,
  raw_data jsonb, -- Store original Excel row data
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_eax_loads_raw_load_id ON public.eax_loads_raw(load_id);
CREATE INDEX IF NOT EXISTS idx_eax_loads_raw_pickup_date ON public.eax_loads_raw(pickup_date);
CREATE INDEX IF NOT EXISTS idx_eax_loads_raw_created_at ON public.eax_loads_raw(created_at);

-- Add constraint to ensure load_id is not empty
ALTER TABLE public.eax_loads_raw ADD CONSTRAINT check_load_id_not_empty CHECK (length(trim(load_id)) > 0);
