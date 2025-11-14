-- Migration: Add favorites notification types to notifications table constraint
-- Description: Adds exact_match, state_match, state_pref_bid, similar_load, and favorite_available notification types

-- Drop existing type constraint if it exists
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Add new constraint with all notification types including favorites
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
  -- Carrier notification types
  'admin_message',        -- Carrier: Admin sent message
  'profile_approved',     -- Carrier: Profile approved by admin
  'profile_declined',     -- Carrier: Profile declined by admin
  -- Favorites notification types
  'exact_match',          -- Carrier: Exact route match found
  'state_match',          -- Carrier: State-to-state route match found
  'state_pref_bid',      -- Carrier: State preference bid match found (formerly similar_load)
  'similar_load',        -- Carrier: Similar load match found (legacy, maps to state_pref_bid)
  'favorite_available'    -- Carrier: Favorite load is available
));

COMMENT ON CONSTRAINT notifications_type_check ON notifications IS 
'Notification type constraint including all system, admin, carrier, and favorites notification types';

