-- Migration: Add Critical Indexes for Notification System Scalability
-- Description: Adds composite indexes to optimize notification processing queries
-- Date: 2025-01-11

-- Composite index for notification_logs lookups (most common query pattern)
-- This index optimizes: WHERE user_id = X AND bid_number = Y AND notification_type = Z AND sent_at > TIME
CREATE INDEX IF NOT EXISTS idx_notification_logs_user_bid_type_sent 
ON notification_logs(supabase_carrier_user_id, bid_number, notification_type, sent_at DESC);

-- Composite index for active triggers lookup
-- This index optimizes: WHERE is_active = true AND trigger_type = X AND user_id = Y
CREATE INDEX IF NOT EXISTS idx_notification_triggers_active_type_user 
ON notification_triggers(is_active, trigger_type, supabase_carrier_user_id) 
WHERE is_active = true;

-- Partial index for active telegram_bids (most queried subset)
-- This index optimizes: WHERE is_archived = false (we can't use NOW() in index predicate)
-- Note: The time-based filtering will be done in queries, but this index helps with is_archived = false
CREATE INDEX IF NOT EXISTS idx_telegram_bids_active_received 
ON telegram_bids(received_at DESC) 
WHERE is_archived = false;

-- Index for notification_logs time-based queries (for rate limiting)
CREATE INDEX IF NOT EXISTS idx_notification_logs_user_sent_at 
ON notification_logs(supabase_carrier_user_id, sent_at DESC);

-- Composite index for notification_triggers with trigger_config lookups
-- Helps with queries that filter by trigger_type and check is_active
CREATE INDEX IF NOT EXISTS idx_notification_triggers_type_active 
ON notification_triggers(trigger_type, is_active, supabase_carrier_user_id);

-- Index for carrier_notification_preferences lookups (frequently accessed)
CREATE INDEX IF NOT EXISTS idx_carrier_notification_preferences_user_active 
ON carrier_notification_preferences(supabase_carrier_user_id) 
WHERE supabase_carrier_user_id IS NOT NULL;

-- Index for carrier_favorites lookups (used in notification matching)
CREATE INDEX IF NOT EXISTS idx_carrier_favorites_user_bid 
ON carrier_favorites(supabase_carrier_user_id, bid_number);

-- Index for telegram_bids state-based queries (for state match notifications)
CREATE INDEX IF NOT EXISTS idx_telegram_bids_tag_active 
ON telegram_bids(tag, is_archived, received_at DESC) 
WHERE is_archived = false;

-- Comments for documentation
COMMENT ON INDEX idx_notification_logs_user_bid_type_sent IS 
  'Optimizes notification history lookups to prevent duplicate notifications';

COMMENT ON INDEX idx_notification_triggers_active_type_user IS 
  'Optimizes active trigger queries for notification processing';

COMMENT ON INDEX idx_telegram_bids_active_received IS 
  'Optimizes queries for active (non-archived) bids ordered by received_at';

