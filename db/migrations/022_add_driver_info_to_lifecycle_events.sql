-- Add driver information fields to load_lifecycle_events table
-- This allows tracking driver information changes in the timeline

ALTER TABLE load_lifecycle_events 
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
ADD COLUMN IF NOT EXISTS event_type TEXT DEFAULT 'status_change';

-- Add index for driver info queries
CREATE INDEX IF NOT EXISTS idx_load_lifecycle_events_driver_info ON load_lifecycle_events(driver_name, truck_number);

-- Add comment to explain the workflow
COMMENT ON COLUMN load_lifecycle_events.event_type IS 'Type of event: status_change, driver_info_update, location_update, etc.';
COMMENT ON COLUMN load_lifecycle_events.driver_name IS 'Primary driver name for this event';
COMMENT ON COLUMN load_lifecycle_events.second_driver_name IS 'Secondary driver name if applicable';

