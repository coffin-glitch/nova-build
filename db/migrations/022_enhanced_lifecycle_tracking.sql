-- Migration: Enhance Load Lifecycle Events Table
-- Description: Adds additional fields for comprehensive load tracking

-- Add new fields to load_lifecycle_events table
ALTER TABLE load_lifecycle_events ADD COLUMN IF NOT EXISTS check_in_time TIMESTAMP WITH TIME ZONE;
ALTER TABLE load_lifecycle_events ADD COLUMN IF NOT EXISTS pickup_time TIMESTAMP WITH TIME ZONE;
ALTER TABLE load_lifecycle_events ADD COLUMN IF NOT EXISTS departure_time TIMESTAMP WITH TIME ZONE;
ALTER TABLE load_lifecycle_events ADD COLUMN IF NOT EXISTS delivery_time TIMESTAMP WITH TIME ZONE;
ALTER TABLE load_lifecycle_events ADD COLUMN IF NOT EXISTS driver_name TEXT;
ALTER TABLE load_lifecycle_events ADD COLUMN IF NOT EXISTS truck_number TEXT;
ALTER TABLE load_lifecycle_events ADD COLUMN IF NOT EXISTS trailer_number TEXT;

-- Create indexes for better performance on new fields
CREATE INDEX IF NOT EXISTS idx_load_lifecycle_events_check_in_time ON load_lifecycle_events(check_in_time);
CREATE INDEX IF NOT EXISTS idx_load_lifecycle_events_pickup_time ON load_lifecycle_events(pickup_time);
CREATE INDEX IF NOT EXISTS idx_load_lifecycle_events_departure_time ON load_lifecycle_events(departure_time);
CREATE INDEX IF NOT EXISTS idx_load_lifecycle_events_delivery_time ON load_lifecycle_events(delivery_time);
CREATE INDEX IF NOT EXISTS idx_load_lifecycle_events_driver_name ON load_lifecycle_events(driver_name);
CREATE INDEX IF NOT EXISTS idx_load_lifecycle_events_truck_number ON load_lifecycle_events(truck_number);
CREATE INDEX IF NOT EXISTS idx_load_lifecycle_events_trailer_number ON load_lifecycle_events(trailer_number);
