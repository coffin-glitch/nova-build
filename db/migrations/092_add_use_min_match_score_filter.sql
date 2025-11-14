-- Migration: Add use_min_match_score_filter column
-- Description: Add toggle to enable/disable min match score filtering while still showing scores on cards

-- Add the column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'carrier_notification_preferences' AND column_name = 'use_min_match_score_filter') THEN
        ALTER TABLE carrier_notification_preferences 
        ADD COLUMN use_min_match_score_filter BOOLEAN DEFAULT true;
        
        COMMENT ON COLUMN carrier_notification_preferences.use_min_match_score_filter IS 
        'Whether to apply min match score filter to notifications. When false, scores still display on cards but all matches trigger notifications.';
    END IF;
END $$;

