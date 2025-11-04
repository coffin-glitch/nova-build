-- Migration 076: Add supabase_user_id to carrier_notifications table
-- Description: Adds supabase_user_id column to support Supabase Auth migration

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'carrier_notifications' AND column_name = 'supabase_user_id'
    ) THEN
        ALTER TABLE carrier_notifications ADD COLUMN supabase_user_id TEXT;
        CREATE INDEX IF NOT EXISTS idx_carrier_notifications_supabase_user_id 
            ON carrier_notifications(supabase_user_id) WHERE supabase_user_id IS NOT NULL;
        
        COMMENT ON COLUMN carrier_notifications.supabase_user_id IS 
            'Supabase user ID for carrier. Maps to carrier_user_id via email.';
    END IF;
END $$;


