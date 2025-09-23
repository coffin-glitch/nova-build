CREATE TABLE IF NOT EXISTS public.notifications (
  id SERIAL PRIMARY KEY,
  clerk_user_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('offer_accepted', 'offer_rejected', 'offer_countered', 'new_bid', 'assignment_created')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications (clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications (type);
CREATE INDEX IF NOT EXISTS idx_notifications_read_at ON public.notifications (read_at);
