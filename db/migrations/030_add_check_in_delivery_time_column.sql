-- Add check_in_delivery_time column to load_lifecycle_events table
-- This separates the event creation timestamp from the actual check-in delivery time

ALTER TABLE load_lifecycle_events 
ADD COLUMN check_in_delivery_time timestamp with time zone;

-- Add comment to explain the difference
COMMENT ON COLUMN load_lifecycle_events.check_in_delivery_time IS 'The actual check-in delivery time selected by the user (for checked_in_delivery events)';
