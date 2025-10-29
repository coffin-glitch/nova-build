-- Migration: Ensure carrier_notification_preferences has all required columns
-- Description: Safely adds all columns needed by the notification preferences system

-- Ensure the table exists first
CREATE TABLE IF NOT EXISTS carrier_notification_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    carrier_user_id TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add base notification columns if they don't exist
DO $$ 
BEGIN
    -- Basic notification columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'carrier_notification_preferences' AND column_name = 'email_notifications') THEN
        ALTER TABLE carrier_notification_preferences ADD COLUMN email_notifications BOOLEAN DEFAULT true;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'carrier_notification_preferences' AND column_name = 'similar_load_notifications') THEN
        ALTER TABLE carrier_notification_preferences ADD COLUMN similar_load_notifications BOOLEAN DEFAULT true;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'carrier_notification_preferences' AND column_name = 'distance_threshold_miles') THEN
        ALTER TABLE carrier_notification_preferences ADD COLUMN distance_threshold_miles INTEGER DEFAULT 50;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'carrier_notification_preferences' AND column_name = 'state_preferences') THEN
        ALTER TABLE carrier_notification_preferences ADD COLUMN state_preferences TEXT[];
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'carrier_notification_preferences' AND column_name = 'equipment_preferences') THEN
        ALTER TABLE carrier_notification_preferences ADD COLUMN equipment_preferences TEXT[];
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'carrier_notification_preferences' AND column_name = 'min_distance') THEN
        ALTER TABLE carrier_notification_preferences ADD COLUMN min_distance INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'carrier_notification_preferences' AND column_name = 'max_distance') THEN
        ALTER TABLE carrier_notification_preferences ADD COLUMN max_distance INTEGER DEFAULT 2000;
    END IF;

    -- Advanced matching criteria columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'carrier_notification_preferences' AND column_name = 'min_match_score') THEN
        ALTER TABLE carrier_notification_preferences ADD COLUMN min_match_score INTEGER DEFAULT 70;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'carrier_notification_preferences' AND column_name = 'route_match_threshold') THEN
        ALTER TABLE carrier_notification_preferences ADD COLUMN route_match_threshold INTEGER DEFAULT 60;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'carrier_notification_preferences' AND column_name = 'distance_flexibility') THEN
        ALTER TABLE carrier_notification_preferences ADD COLUMN distance_flexibility INTEGER DEFAULT 25;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'carrier_notification_preferences' AND column_name = 'timing_relevance_days') THEN
        ALTER TABLE carrier_notification_preferences ADD COLUMN timing_relevance_days INTEGER DEFAULT 7;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'carrier_notification_preferences' AND column_name = 'prioritize_backhaul') THEN
        ALTER TABLE carrier_notification_preferences ADD COLUMN prioritize_backhaul BOOLEAN DEFAULT true;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'carrier_notification_preferences' AND column_name = 'avoid_high_competition') THEN
        ALTER TABLE carrier_notification_preferences ADD COLUMN avoid_high_competition BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'carrier_notification_preferences' AND column_name = 'max_competition_bids') THEN
        ALTER TABLE carrier_notification_preferences ADD COLUMN max_competition_bids INTEGER DEFAULT 10;
    END IF;

    -- Ensure timestamp columns exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'carrier_notification_preferences' AND column_name = 'created_at') THEN
        ALTER TABLE carrier_notification_preferences ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'carrier_notification_preferences' AND column_name = 'updated_at') THEN
        ALTER TABLE carrier_notification_preferences ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    END IF;

END $$;

-- Ensure unique constraint on carrier_user_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'carrier_notification_preferences_carrier_user_id_key'
    ) THEN
        ALTER TABLE carrier_notification_preferences 
        ADD CONSTRAINT carrier_notification_preferences_carrier_user_id_key 
        UNIQUE (carrier_user_id);
    END IF;
END $$;

-- Ensure notification_type is nullable (it shouldn't be NOT NULL for preferences)
DO $$
BEGIN
    -- Check if notification_type exists and make it nullable if it has NOT NULL constraint
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'carrier_notification_preferences' 
               AND column_name = 'notification_type'
               AND is_nullable = 'NO') THEN
        ALTER TABLE carrier_notification_preferences 
          ALTER COLUMN notification_type DROP NOT NULL,
          ALTER COLUMN notification_type SET DEFAULT NULL;
    END IF;
END $$;

-- Create index if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_carrier_notification_preferences_carrier_user_id 
ON carrier_notification_preferences(carrier_user_id);

