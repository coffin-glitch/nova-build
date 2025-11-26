-- Migration: Add indexes for notification trigger filtering
-- Description: Optimizes queries that filter triggers based on bid information
--              Dramatically improves performance when pre-filtering triggers

-- Index on trigger_config->'statePreferences' for fast state preference filtering
-- This allows us to quickly find triggers that match a bid's origin state
CREATE INDEX IF NOT EXISTS idx_trigger_config_state_prefs 
ON notification_triggers 
USING GIN ((trigger_config->'statePreferences'));

-- Index on trigger_config->>'favoriteStops' for exact match filtering
-- This allows us to quickly find triggers that might match a bid's route
CREATE INDEX IF NOT EXISTS idx_trigger_config_favorite_stops 
ON notification_triggers 
USING GIN (to_tsvector('english', trigger_config->>'favoriteStops'));

-- Index on trigger_type and is_active for faster filtering
-- Most queries filter by these columns
CREATE INDEX IF NOT EXISTS idx_trigger_type_active 
ON notification_triggers (trigger_type, is_active) 
WHERE is_active = true;

-- Index on state_preferences array for carrier_notification_preferences
-- This allows fast filtering of users whose state preferences match a bid's origin state
CREATE INDEX IF NOT EXISTS idx_carrier_prefs_state_prefs 
ON carrier_notification_preferences 
USING GIN (state_preferences);

-- Index on similar_load_notifications flag
CREATE INDEX IF NOT EXISTS idx_carrier_prefs_similar_load 
ON carrier_notification_preferences (similar_load_notifications) 
WHERE similar_load_notifications = true;

COMMENT ON INDEX idx_trigger_config_state_prefs IS 'GIN index for fast filtering of state preference triggers';
COMMENT ON INDEX idx_trigger_config_favorite_stops IS 'Full-text index for fast filtering of exact match triggers by route';
COMMENT ON INDEX idx_trigger_type_active IS 'B-tree index for fast filtering by trigger type and active status';
COMMENT ON INDEX idx_carrier_prefs_state_prefs IS 'GIN index for fast filtering of users by state preferences';
COMMENT ON INDEX idx_carrier_prefs_similar_load IS 'B-tree index for fast filtering of users with similar load notifications enabled';

