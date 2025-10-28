-- Migration: Add date/time fields to bid_lifecycle_events table
-- Description: Adds specific date/time fields for status updates

-- Add date/time fields to bid_lifecycle_events table
ALTER TABLE bid_lifecycle_events 
ADD COLUMN IF NOT EXISTS check_in_time TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS pickup_time TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS departure_time TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS check_in_delivery_time TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS delivery_time TIMESTAMP WITH TIME ZONE;

-- Create indexes for better performance on new fields
CREATE INDEX IF NOT EXISTS idx_bid_lifecycle_events_check_in_time ON bid_lifecycle_events(check_in_time);
CREATE INDEX IF NOT EXISTS idx_bid_lifecycle_events_pickup_time ON bid_lifecycle_events(pickup_time);
CREATE INDEX IF NOT EXISTS idx_bid_lifecycle_events_departure_time ON bid_lifecycle_events(departure_time);
CREATE INDEX IF NOT EXISTS idx_bid_lifecycle_events_check_in_delivery_time ON bid_lifecycle_events(check_in_delivery_time);
CREATE INDEX IF NOT EXISTS idx_bid_lifecycle_events_delivery_time ON bid_lifecycle_events(delivery_time);

-- Add comments
COMMENT ON COLUMN bid_lifecycle_events.check_in_time IS 'The actual check-in time selected by the user (for checked_in_origin events)';
COMMENT ON COLUMN bid_lifecycle_events.pickup_time IS 'The actual pickup time selected by the user (for picked_up events)';
COMMENT ON COLUMN bid_lifecycle_events.departure_time IS 'The actual departure time selected by the user (for departed_origin events)';
COMMENT ON COLUMN bid_lifecycle_events.check_in_delivery_time IS 'The actual check-in time at destination selected by the user (for checked_in_destination events)';
COMMENT ON COLUMN bid_lifecycle_events.delivery_time IS 'The actual delivery time selected by the user (for delivered events)';
