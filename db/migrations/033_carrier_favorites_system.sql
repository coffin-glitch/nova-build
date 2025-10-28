-- PostgreSQL Migration: Carrier Favorites System
-- Description: Creates tables for carrier favorites and notification preferences

-- Create carrier_favorites table to store favorited bids
CREATE TABLE IF NOT EXISTS carrier_favorites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    carrier_user_id TEXT NOT NULL,
    bid_number TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(carrier_user_id, bid_number)
);

-- Create carrier_notification_preferences table for notification settings
CREATE TABLE IF NOT EXISTS carrier_notification_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    carrier_user_id TEXT NOT NULL UNIQUE,
    email_notifications BOOLEAN DEFAULT true,
    similar_load_notifications BOOLEAN DEFAULT true,
    distance_threshold_miles INTEGER DEFAULT 50,
    state_preferences TEXT[], -- Array of preferred states
    equipment_preferences TEXT[], -- Array of preferred equipment types
    min_distance INTEGER DEFAULT 0,
    max_distance INTEGER DEFAULT 2000,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Carrier notifications table already exists, just add bid_number column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'carrier_notifications' AND column_name = 'bid_number') THEN
        ALTER TABLE carrier_notifications ADD COLUMN bid_number TEXT;
    END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_carrier_favorites_carrier_user_id ON carrier_favorites(carrier_user_id);
CREATE INDEX IF NOT EXISTS idx_carrier_favorites_bid_number ON carrier_favorites(bid_number);
CREATE INDEX IF NOT EXISTS idx_carrier_notification_preferences_carrier_user_id ON carrier_notification_preferences(carrier_user_id);
CREATE INDEX IF NOT EXISTS idx_carrier_notifications_bid_number ON carrier_notifications(bid_number);

-- Add foreign key constraints (optional, for data integrity)
-- ALTER TABLE carrier_favorites ADD CONSTRAINT fk_carrier_favorites_carrier_user_id 
--     FOREIGN KEY (carrier_user_id) REFERENCES carrier_profiles(user_id) ON DELETE CASCADE;

-- ALTER TABLE carrier_notification_preferences ADD CONSTRAINT fk_carrier_notification_preferences_carrier_user_id 
--     FOREIGN KEY (carrier_user_id) REFERENCES carrier_profiles(user_id) ON DELETE CASCADE;

-- ALTER TABLE carrier_notifications ADD CONSTRAINT fk_carrier_notifications_carrier_user_id 
--     FOREIGN KEY (carrier_user_id) REFERENCES carrier_profiles(user_id) ON DELETE CASCADE;
