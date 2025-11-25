-- Migration: Add notifications_disabled column to carrier_profiles
-- Description: Allows admins to completely disable notifications for a carrier (kill switch)
-- Date: 2025-01-25

-- Add notifications_disabled column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'carrier_profiles' AND column_name = 'notifications_disabled'
    ) THEN
        ALTER TABLE carrier_profiles 
        ADD COLUMN notifications_disabled BOOLEAN DEFAULT false NOT NULL;
        
        -- Create index for quick lookups
        CREATE INDEX IF NOT EXISTS idx_carrier_profiles_notifications_disabled 
        ON carrier_profiles(notifications_disabled) 
        WHERE notifications_disabled = true;
        
        COMMENT ON COLUMN carrier_profiles.notifications_disabled IS 
        'Kill switch to completely disable all notifications for a carrier. When true, no notifications will be sent regardless of tier.';
        
        RAISE NOTICE 'Added notifications_disabled column to carrier_profiles';
    ELSE
        RAISE NOTICE 'notifications_disabled column already exists';
    END IF;
END $$;


