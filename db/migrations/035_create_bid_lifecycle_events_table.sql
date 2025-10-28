-- Migration: Create bid_lifecycle_events table
-- Description: Creates the missing bid_lifecycle_events table for tracking bid status changes

-- Create bid_lifecycle_events table
CREATE TABLE IF NOT EXISTS bid_lifecycle_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bid_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    event_data JSONB,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    documents TEXT[],
    location TEXT,
    driver_name TEXT,
    driver_phone TEXT,
    driver_email TEXT,
    driver_license_number TEXT,
    driver_license_state TEXT,
    truck_number TEXT,
    trailer_number TEXT,
    second_driver_name TEXT,
    second_driver_phone TEXT,
    second_driver_email TEXT,
    second_driver_license_number TEXT,
    second_driver_license_state TEXT,
    second_truck_number TEXT,
    second_trailer_number TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_bid_lifecycle_events_bid_id ON bid_lifecycle_events(bid_id);
CREATE INDEX IF NOT EXISTS idx_bid_lifecycle_events_timestamp ON bid_lifecycle_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_bid_lifecycle_events_event_type ON bid_lifecycle_events(event_type);
CREATE INDEX IF NOT EXISTS idx_bid_lifecycle_events_driver_info ON bid_lifecycle_events(driver_name, truck_number);

-- Add comments
COMMENT ON TABLE bid_lifecycle_events IS 'Tracks lifecycle events for awarded bids';
COMMENT ON COLUMN bid_lifecycle_events.bid_id IS 'The bid number this event relates to';
COMMENT ON COLUMN bid_lifecycle_events.event_type IS 'Type of event: bid_awarded, load_assigned, checked_in_origin, picked_up, etc.';
COMMENT ON COLUMN bid_lifecycle_events.event_data IS 'Additional event data as JSON';
COMMENT ON COLUMN bid_lifecycle_events.timestamp IS 'When the event occurred';
COMMENT ON COLUMN bid_lifecycle_events.notes IS 'Additional notes about the event';
COMMENT ON COLUMN bid_lifecycle_events.documents IS 'Array of document URLs related to this event';
COMMENT ON COLUMN bid_lifecycle_events.location IS 'Location where the event occurred';
COMMENT ON COLUMN bid_lifecycle_events.driver_name IS 'Primary driver name for this event';
COMMENT ON COLUMN bid_lifecycle_events.truck_number IS 'Truck number for this event';

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_bid_lifecycle_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_bid_lifecycle_events_updated_at ON bid_lifecycle_events;
CREATE TRIGGER update_bid_lifecycle_events_updated_at
    BEFORE UPDATE ON bid_lifecycle_events
    FOR EACH ROW
    EXECUTE FUNCTION update_bid_lifecycle_events_updated_at();
