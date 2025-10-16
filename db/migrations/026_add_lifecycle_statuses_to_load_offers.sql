-- Add all lifecycle statuses to load_offers table
-- This allows load offers to track the complete lifecycle from assigned to completed

-- Drop the existing check constraint
ALTER TABLE load_offers DROP CONSTRAINT IF EXISTS load_offers_status_check;

-- Add the new constraint with all lifecycle statuses included
ALTER TABLE load_offers ADD CONSTRAINT load_offers_status_check 
CHECK (status = ANY (ARRAY[
  'pending'::text, 
  'accepted'::text, 
  'assigned'::text, 
  'checked_in'::text,
  'picked_up'::text,
  'departed'::text,
  'in_transit'::text,
  'delivered'::text,
  'completed'::text,
  'rejected'::text, 
  'countered'::text, 
  'expired'::text, 
  'withdrawn'::text
]));

-- Update comment to explain the complete workflow
COMMENT ON COLUMN load_offers.status IS 'Offer status: pending -> accepted -> assigned -> checked_in -> picked_up -> departed -> in_transit -> delivered -> completed (or rejected/countered/expired/withdrawn)';
