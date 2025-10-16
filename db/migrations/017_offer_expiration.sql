-- Add offer expiration functionality
-- This migration adds expiration tracking to load_offers table

-- Add expiration timestamp column
ALTER TABLE public.load_offers 
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Add expiration status tracking
ALTER TABLE public.load_offers 
ADD COLUMN IF NOT EXISTS is_expired BOOLEAN DEFAULT FALSE;

-- Add index for efficient expiration queries
CREATE INDEX IF NOT EXISTS idx_load_offers_expires_at ON public.load_offers (expires_at);
CREATE INDEX IF NOT EXISTS idx_load_offers_is_expired ON public.load_offers (is_expired);

-- Add index for active (non-expired) offers
CREATE INDEX IF NOT EXISTS idx_load_offers_active ON public.load_offers (is_expired, status) WHERE is_expired = FALSE;

-- Update existing offers to have expiration (24 hours from creation)
UPDATE public.load_offers 
SET expires_at = created_at + INTERVAL '24 hours'
WHERE expires_at IS NULL;

-- Mark any offers older than 24 hours as expired
UPDATE public.load_offers 
SET is_expired = TRUE
WHERE expires_at < NOW() AND status = 'pending';
