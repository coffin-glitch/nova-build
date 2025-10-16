-- Add pickup_time column to load_lifecycle_events table
-- This separates the event creation timestamp from the actual pickup time

ALTER TABLE load_lifecycle_events 
ADD COLUMN pickup_time timestamp with time zone;

-- Add comment to explain the difference
COMMENT ON COLUMN load_lifecycle_events.pickup_time IS 'The actual pickup time selected by the user (for picked_up events)';
