-- Migration: Add notification_tier column to carrier_profiles
-- Description: Enables tiered rate limiting for notifications (premium, standard, new)
-- Date: 2025-01-13

-- Add notification_tier column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'carrier_profiles' AND column_name = 'notification_tier'
    ) THEN
        ALTER TABLE carrier_profiles 
        ADD COLUMN notification_tier TEXT DEFAULT 'standard' 
        CHECK (notification_tier IN ('premium', 'standard', 'new'));
        
        -- Create index for tier lookups
        CREATE INDEX IF NOT EXISTS idx_carrier_profiles_notification_tier 
        ON carrier_profiles(notification_tier) 
        WHERE notification_tier IS NOT NULL;
        
        COMMENT ON COLUMN carrier_profiles.notification_tier IS 
        'User tier for notification rate limiting: premium (200/hr), standard (50/hr), new (20/hr)';
        
        RAISE NOTICE 'Added notification_tier column to carrier_profiles';
    ELSE
        RAISE NOTICE 'notification_tier column already exists';
    END IF;
END $$;

