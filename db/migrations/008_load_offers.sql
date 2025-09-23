CREATE TABLE IF NOT EXISTS public.load_offers (
  id SERIAL PRIMARY KEY,
  load_id BIGINT NOT NULL REFERENCES loads(id) ON DELETE CASCADE,
  clerk_user_id TEXT NOT NULL,
  price NUMERIC NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'countered')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_load_offers_load_id ON public.load_offers (load_id);
CREATE INDEX IF NOT EXISTS idx_load_offers_user_id ON public.load_offers (clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_load_offers_status ON public.load_offers (status);
