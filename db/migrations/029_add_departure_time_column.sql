-- Add departure_time column to load_lifecycle_events table
-- This separates the event creation timestamp from the actual departure time

ALTER TABLE load_lifecycle_events 
ADD COLUMN departure_time timestamp with time zone;

-- Add comment to explain the difference
COMMENT ON COLUMN load_lifecycle_events.departure_time IS 'The actual departure time selected by the user (for departed events)';
