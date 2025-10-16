-- Create offer_comments table for admin-carrier communication
CREATE TABLE IF NOT EXISTS public.offer_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL REFERENCES public.load_offers(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL, -- Clerk user ID of the comment author
  author_role TEXT NOT NULL CHECK (author_role IN ('admin', 'carrier')), -- Role of the comment author
  comment_text TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT FALSE, -- Internal comments visible only to admins
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_offer_comments_offer_id ON public.offer_comments (offer_id);
CREATE INDEX IF NOT EXISTS idx_offer_comments_author_id ON public.offer_comments (author_id);
CREATE INDEX IF NOT EXISTS idx_offer_comments_created_at ON public.offer_comments (created_at);
CREATE INDEX IF NOT EXISTS idx_offer_comments_is_internal ON public.offer_comments (is_internal);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_offer_comments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_offer_comments_updated_at
  BEFORE UPDATE ON public.offer_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_offer_comments_updated_at();
