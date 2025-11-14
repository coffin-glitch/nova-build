-- Migration: Update notification types for comprehensive notification system
-- Description: Adds new notification types for admin and carrier notifications, optimizes unread count queries

-- Drop existing type constraint if it exists
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Add new constraint with all notification types
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
  -- New admin notification types
  'new_lowest_bid',        -- Admin: New lowest bid placed on auction
  'carrier_message',       -- Admin: Carrier sent message via floating chat
  'bid_message',           -- Admin: Carrier sent message about specific bid
  'profile_submission',    -- Admin: Carrier submitted profile for approval
  'bid_accepted',          -- Admin: Carrier accepted an awarded bid
  -- New carrier notification types
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

-- Add index for optimized unread count queries (using user_id column)
CREATE INDEX IF NOT EXISTS idx_notifications_unread 
ON notifications(user_id, read) 
WHERE read = false;

-- Add comment explaining the index
COMMENT ON INDEX idx_notifications_unread IS 'Optimized index for fast unread notification count queries';

-- Add comment to notifications table
COMMENT ON TABLE notifications IS 'System notifications for both admins and carriers. Types include bid events, messages, profile submissions, and system alerts.';

