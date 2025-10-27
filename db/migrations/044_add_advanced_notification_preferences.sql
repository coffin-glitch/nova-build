-- Migration: Add Advanced Notification Preferences Columns
-- Description: Add industry-leading notification filtering capabilities

-- Add advanced matching criteria columns
ALTER TABLE carrier_notification_preferences 
  ADD COLUMN IF NOT EXISTS min_match_score INTEGER DEFAULT 70,
  ADD COLUMN IF NOT EXISTS route_match_threshold INTEGER DEFAULT 60,
  ADD COLUMN IF NOT EXISTS equipment_strict BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS distance_flexibility INTEGER DEFAULT 25,
  ADD COLUMN IF NOT EXISTS timing_relevance_days INTEGER DEFAULT 7,
  ADD COLUMN IF NOT EXISTS prioritize_backhaul BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS market_price_alerts BOOLEAN DEFAULT true;

-- Add smart filtering columns
ALTER TABLE carrier_notification_preferences
  ADD COLUMN IF NOT EXISTS route_origins TEXT[],
  ADD COLUMN IF NOT EXISTS route_destinations TEXT[],
  ADD COLUMN IF NOT EXISTS avoid_high_competition BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_competition_bids INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS price_sensitivity TEXT DEFAULT 'medium';

-- Add timing preferences columns
ALTER TABLE carrier_notification_preferences
  ADD COLUMN IF NOT EXISTS minimum_transit_hours INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS maximum_transit_hours INTEGER DEFAULT 168,
  ADD COLUMN IF NOT EXISTS preferred_pickup_days TEXT[],
  ADD COLUMN IF NOT EXISTS avoid_weekends BOOLEAN DEFAULT true;

-- Add market intelligence columns
ALTER TABLE carrier_notification_preferences
  ADD COLUMN IF NOT EXISTS track_market_trends BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS alert_on_price_drops BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS alert_on_new_routes BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS market_baseline_price DECIMAL(10, 2) DEFAULT 0;

-- Add comments for documentation
COMMENT ON COLUMN carrier_notification_preferences.min_match_score IS 'Minimum similarity score to trigger notification (0-100)';
COMMENT ON COLUMN carrier_notification_preferences.route_match_threshold IS 'Minimum route similarity percentage';
COMMENT ON COLUMN carrier_notification_preferences.equipment_strict IS 'Require exact equipment match';
COMMENT ON COLUMN carrier_notification_preferences.distance_flexibility IS 'Distance variance allowance (0-50%)';
COMMENT ON COLUMN carrier_notification_preferences.timing_relevance_days IS 'Days ahead to consider for timing matches';
COMMENT ON COLUMN carrier_notification_preferences.prioritize_backhaul IS 'Prefer return route matches';
COMMENT ON COLUMN carrier_notification_preferences.route_origins IS 'Preferred origin cities';
COMMENT ON COLUMN carrier_notification_preferences.route_destinations IS 'Preferred destination cities';
COMMENT ON COLUMN carrier_notification_preferences.price_sensitivity IS 'How price-sensitive: low/medium/high';

