-- Add 'assigned' status to load_offers table
-- This allows load offers to transition from 'accepted' to 'assigned' when a load is assigned to a carrier

-- Drop the existing check constraint
ALTER TABLE load_offers DROP CONSTRAINT IF EXISTS load_offers_status_check;

-- Add the new constraint with 'assigned' included
ALTER TABLE load_offers ADD CONSTRAINT load_offers_status_check 
CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'assigned'::text, 'rejected'::text, 'countered'::text, 'expired'::text, 'withdrawn'::text]));

-- Add comment to explain the workflow
COMMENT ON COLUMN load_offers.status IS 'Offer status: pending -> accepted -> assigned -> (execution lifecycle tracked in load_lifecycle_events)';
