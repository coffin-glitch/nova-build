-- Migration: Fix notification type constraint to include bid_expired_needs_award
-- Description: Adds back bid_expired_needs_award type that was missing from migration 114

-- Drop existing type constraint
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Add new constraint with all notification types including bid_expired_needs_award
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
  'new_lowest_bid',
  'carrier_message',
  'bid_message',
  'profile_submission',
  'bid_accepted',
  'bid_expired_needs_award', -- Admin: Bid expired with carrier bids, needs winner selected
  -- Carrier notification types
  'admin_message',
  'profile_approved',
  'profile_declined',
  -- Favorites notification types
  'exact_match',
  'state_match',
  'state_pref_bid',
  'similar_load',
  'favorite_available',
  -- Announcements
  'announcement'  -- System announcements
));

COMMENT ON CONSTRAINT notifications_type_check ON notifications IS 
'Notification type constraint including all system, admin, carrier, favorites, and announcement notification types';

