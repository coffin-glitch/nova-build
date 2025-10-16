-- Add checked_in_delivery status to load_offers table constraint
-- This ensures the new status is allowed in the database

-- Drop the existing check constraint
ALTER TABLE load_offers DROP CONSTRAINT IF EXISTS load_offers_status_check;

-- Add the new constraint with checked_in_delivery status included
ALTER TABLE load_offers ADD CONSTRAINT load_offers_status_check 
CHECK (status = ANY (ARRAY[
  'pending'::text, 
  'accepted'::text, 
  'assigned'::text, 
  'checked_in'::text,
  'picked_up'::text,
  'departed'::text,
  'in_transit'::text,
  'checked_in_delivery'::text,
  'delivered'::text,
  'completed'::text,
  'rejected'::text, 
  'countered'::text, 
  'expired'::text, 
  'withdrawn'::text
]));

COMMENT ON CONSTRAINT load_offers_status_check ON load_offers IS 'Ensures load offer status is one of the predefined values including checked_in_delivery.';
