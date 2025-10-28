-- Migration: Add missing columns to bid_lifecycle_events table
-- Description: Adds driver info, location, and other missing columns

-- Add missing columns to bid_lifecycle_events table
ALTER TABLE bid_lifecycle_events 
ADD COLUMN IF NOT EXISTS location TEXT,
ADD COLUMN IF NOT EXISTS driver_name TEXT,
ADD COLUMN IF NOT EXISTS driver_phone TEXT,
ADD COLUMN IF NOT EXISTS driver_email TEXT,
ADD COLUMN IF NOT EXISTS driver_license_number TEXT,
ADD COLUMN IF NOT EXISTS driver_license_state TEXT,
ADD COLUMN IF NOT EXISTS truck_number TEXT,
ADD COLUMN IF NOT EXISTS trailer_number TEXT,
ADD COLUMN IF NOT EXISTS second_driver_name TEXT,
ADD COLUMN IF NOT EXISTS second_driver_phone TEXT,
ADD COLUMN IF NOT EXISTS second_driver_email TEXT,
ADD COLUMN IF NOT EXISTS second_driver_license_number TEXT,
ADD COLUMN IF NOT EXISTS second_driver_license_state TEXT,
ADD COLUMN IF NOT EXISTS second_truck_number TEXT,
ADD COLUMN IF NOT EXISTS second_trailer_number TEXT,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Create indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_bid_lifecycle_events_driver_info ON bid_lifecycle_events(driver_name, truck_number);
CREATE INDEX IF NOT EXISTS idx_bid_lifecycle_events_location ON bid_lifecycle_events(location);

-- Add comments
COMMENT ON COLUMN bid_lifecycle_events.location IS 'Location where the event occurred';
COMMENT ON COLUMN bid_lifecycle_events.driver_name IS 'Primary driver name for this event';
COMMENT ON COLUMN bid_lifecycle_events.truck_number IS 'Truck number for this event';
COMMENT ON COLUMN bid_lifecycle_events.created_at IS 'When the record was created';
COMMENT ON COLUMN bid_lifecycle_events.updated_at IS 'When the record was last updated';
