-- Migration 077: Make clerk_user_id nullable in carrier_profiles table
-- Description: Allows carrier_profiles to be created without clerk_user_id for Supabase-only authentication

DO $$ 
BEGIN
    -- Check if clerk_user_id column exists and is NOT NULL
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'carrier_profiles' 
        AND column_name = 'clerk_user_id' 
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE carrier_profiles ALTER COLUMN clerk_user_id DROP NOT NULL;
        
        COMMENT ON COLUMN carrier_profiles.clerk_user_id IS 
            'Legacy Clerk user ID. Now nullable for Supabase-only authentication. Use supabase_user_id for new profiles.';
        
        RAISE NOTICE 'Made clerk_user_id nullable in carrier_profiles';
    ELSE
        RAISE NOTICE 'clerk_user_id is already nullable or does not exist';
    END IF;
END $$;


