-- Migration: Add bid_expired_needs_award notification type
-- Description: Adds notification type for expired bids that need a winner selected

-- Drop existing type constraint
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Add new constraint with bid_expired_needs_award type
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check 
CHECK (type IN (
  -- Existing types
  'bid_won', 
  'bid_lost', 
  'bid_expired', 
  'load_assigned', 
  'bid_received', 
  'system', 
  'info',
  -- Admin notification types
  'new_lowest_bid',        -- Admin: New lowest bid placed on auction
  'carrier_message',       -- Admin: Carrier sent message via floating chat
  'bid_message',           -- Admin: Carrier sent message about specific bid
  'profile_submission',    -- Admin: Carrier submitted profile for approval
  'bid_accepted',          -- Admin: Carrier accepted an awarded bid
  'bid_expired_needs_award', -- Admin: Bid expired with carrier bids, needs winner selected
  -- Carrier notification types
  'admin_message',        -- Carrier: Admin sent message
  'profile_approved',     -- Carrier: Profile approved by admin
  'profile_declined'       -- Carrier: Profile declined by admin
));

