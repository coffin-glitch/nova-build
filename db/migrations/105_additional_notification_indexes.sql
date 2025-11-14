-- Migration: Add Additional Composite Indexes for Notification System
-- Description: Optimizes complex queries for notification listing, unread counts, and cooldown checks
-- Date: 2025-01-14

-- Composite index for notification listing (most common query pattern)
-- Optimizes: WHERE user_id = X AND type = Y ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_notifications_user_type_created 
ON notifications(user_id, type, created_at DESC);

-- Composite index for unread count queries
-- Optimizes: WHERE user_id = X AND read = false
CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created 
ON notifications(user_id, read, created_at DESC) 
WHERE read = false;

-- Composite index for notification_logs cooldown checks
-- Optimizes: WHERE supabase_carrier_user_id = X AND bid_number = Y AND notification_type = Z AND sent_at > TIME
-- Note: This index already exists as idx_notification_logs_user_bid_type_sent, but ensuring it's optimal
CREATE INDEX IF NOT EXISTS idx_notification_logs_user_bid_type_sent_optimized
ON notification_logs(supabase_carrier_user_id, bid_number, notification_type, sent_at DESC)
WHERE supabase_carrier_user_id IS NOT NULL;

-- Composite index for trigger queries with active status
-- Optimizes: WHERE supabase_carrier_user_id = X AND trigger_type = Y AND is_active = true
CREATE INDEX IF NOT EXISTS idx_notification_triggers_user_type_active_optimized
ON notification_triggers(supabase_carrier_user_id, trigger_type, is_active)
WHERE is_active = true AND supabase_carrier_user_id IS NOT NULL;

-- Index for notification type filtering
-- Optimizes: WHERE user_id = X AND type IN (...)
CREATE INDEX IF NOT EXISTS idx_notifications_user_type_filter
ON notifications(user_id, type)
WHERE user_id IS NOT NULL;

-- Comments for documentation
COMMENT ON INDEX idx_notifications_user_type_created IS 
  'Optimizes notification listing queries with type filtering and date sorting';

COMMENT ON INDEX idx_notifications_user_read_created IS 
  'Optimizes unread notification count and listing queries';

COMMENT ON INDEX idx_notification_logs_user_bid_type_sent_optimized IS 
  'Optimizes cooldown checks to prevent duplicate notifications';

COMMENT ON INDEX idx_notification_triggers_user_type_active_optimized IS 
  'Optimizes active trigger queries for notification processing';

COMMENT ON INDEX idx_notifications_user_type_filter IS 
  'Optimizes notification type filtering queries';

