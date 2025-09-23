CREATE TABLE IF NOT EXISTS public.assignments (
  id SERIAL PRIMARY KEY,
  load_id BIGINT NOT NULL REFERENCES loads(id) ON DELETE CASCADE,
  clerk_user_id TEXT NOT NULL,
  accepted_price NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assignments_load_id ON public.assignments (load_id);
CREATE INDEX IF NOT EXISTS idx_assignments_user_id ON public.assignments (clerk_user_id);
