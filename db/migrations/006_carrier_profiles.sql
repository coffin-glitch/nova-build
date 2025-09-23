CREATE TABLE IF NOT EXISTS public.carrier_profiles (
  user_id text PRIMARY KEY,
  mc_number text,
  dot_number text,
  phone text,
  dispatch_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_carrier_profiles_user_id ON public.carrier_profiles(user_id);
