-- Add 'withdrawn' status to load_offers table
-- This allows carriers to withdraw their pending offers

-- Update the status constraint to include 'withdrawn'
ALTER TABLE public.load_offers 
DROP CONSTRAINT IF EXISTS load_offers_status_check;

ALTER TABLE public.load_offers 
ADD CONSTRAINT load_offers_status_check 
CHECK (status IN ('pending', 'accepted', 'rejected', 'countered', 'expired', 'withdrawn'));

-- Add index for withdrawn offers
CREATE INDEX IF NOT EXISTS idx_load_offers_status_withdrawn 
ON public.load_offers (status) 
WHERE status = 'withdrawn';

-- Update any existing offers that might need the new status
-- (This is optional, but ensures consistency)
UPDATE public.load_offers 
SET status = 'withdrawn' 
WHERE status = 'pending' 
AND created_at < NOW() - INTERVAL '7 days' 
AND id NOT IN (
  SELECT DISTINCT offer_id 
  FROM public.offer_history 
  WHERE action IN ('accepted', 'rejected', 'countered')
);
