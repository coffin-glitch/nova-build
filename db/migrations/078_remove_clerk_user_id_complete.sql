-- Migration 078: Complete Removal of clerk_user_id Columns
-- Description: Removes all clerk_user_id columns from database tables
-- This migration should only be run after confirming all data has been migrated to supabase_user_id
-- 
-- WARNING: This is a destructive migration. Ensure you have:
-- 1. Backed up your database
-- 2. Verified all users have supabase_user_id values
-- 3. Confirmed no code references clerk_user_id anymore
--
-- This migration removes:
-- - All clerk_user_id columns from all tables
-- - All indexes on clerk_user_id columns
-- - All foreign key constraints referencing clerk_user_id

BEGIN;

-- ============================================================================
-- STEP 1: Drop foreign key constraints that reference clerk_user_id columns
-- ============================================================================

-- Drop foreign key from carrier_bids to carrier_profiles
DO $$
DECLARE
  r RECORD;
BEGIN
  -- Find and drop all FK constraints on carrier_bids.clerk_user_id
  FOR r IN (
    SELECT constraint_name 
    FROM information_schema.table_constraints 
    WHERE table_name = 'carrier_bids' 
    AND constraint_type = 'FOREIGN KEY'
    AND constraint_name LIKE '%clerk%'
  ) LOOP
    EXECUTE format('ALTER TABLE carrier_bids DROP CONSTRAINT IF EXISTS %I', r.constraint_name);
  END LOOP;
END $$;

-- Drop foreign key from auction_awards to carrier_profiles
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT constraint_name 
    FROM information_schema.table_constraints 
    WHERE table_name = 'auction_awards' 
    AND constraint_type = 'FOREIGN KEY'
    AND constraint_name LIKE '%winner%'
  ) LOOP
    EXECUTE format('ALTER TABLE auction_awards DROP CONSTRAINT IF EXISTS %I', r.constraint_name);
  END LOOP;
END $$;

-- ============================================================================
-- STEP 2: Drop indexes on clerk_user_id columns
-- ============================================================================

-- Drop indexes on carrier_profiles.clerk_user_id
DROP INDEX IF EXISTS idx_carrier_profiles_clerk_user_id;
DROP INDEX IF EXISTS idx_carrier_profiles_user;

-- Drop indexes on carrier_bids.clerk_user_id
DROP INDEX IF EXISTS idx_carrier_bids_clerk_user_id;
DROP INDEX IF EXISTS idx_carrier_bids_user_id;
DROP INDEX IF EXISTS idx_carrier_bids_user;

-- Drop indexes on user_roles_cache.clerk_user_id
DROP INDEX IF EXISTS idx_user_roles_cache_clerk_user_id;

-- Drop any constraints and indexes that reference clerk_user_id
-- First drop unique constraints that reference clerk_user_id
DO $$
DECLARE
  constraint_record RECORD;
BEGIN
  FOR constraint_record IN (
    SELECT constraint_name, table_name
    FROM information_schema.table_constraints 
    WHERE constraint_type IN ('UNIQUE', 'PRIMARY KEY')
    AND (
      constraint_name LIKE '%clerk%'
      OR constraint_name IN (
        SELECT constraint_name FROM information_schema.constraint_column_usage 
        WHERE column_name LIKE '%clerk_user_id%'
      )
    )
  ) LOOP
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I CASCADE', constraint_record.table_name, constraint_record.constraint_name);
  END LOOP;
  
  -- Also drop the carrier_bids unique constraint if it uses clerk_user_id
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'carrier_bids' 
    AND constraint_name LIKE '%bid%user%'
  ) THEN
    -- Check if it references clerk_user_id
    IF EXISTS (
      SELECT 1 FROM information_schema.constraint_column_usage
      WHERE table_name = 'carrier_bids'
      AND column_name = 'clerk_user_id'
    ) THEN
      FOR constraint_record IN (
        SELECT constraint_name FROM information_schema.table_constraints 
        WHERE table_name = 'carrier_bids' 
        AND constraint_name LIKE '%bid%user%'
      ) LOOP
        EXECUTE format('ALTER TABLE carrier_bids DROP CONSTRAINT IF EXISTS %I CASCADE', constraint_record.constraint_name);
      END LOOP;
    END IF;
  END IF;
END $$;

-- Now drop indexes (constraints are already dropped)
DO $$
DECLARE
  idx_record RECORD;
BEGIN
  FOR idx_record IN (
    SELECT indexname 
    FROM pg_indexes 
    WHERE schemaname = 'public'
    AND indexdef LIKE '%clerk_user_id%'
  ) LOOP
    BEGIN
      EXECUTE format('DROP INDEX IF EXISTS %I', idx_record.indexname);
    EXCEPTION
      WHEN OTHERS THEN
        -- Index might be tied to a constraint, skip it
        NULL;
    END;
  END LOOP;
END $$;

-- ============================================================================
-- STEP 3: Drop clerk_user_id columns from all tables
-- ============================================================================

-- Remove clerk_user_id from carrier_profiles (may be PRIMARY KEY, handle carefully)
DO $$
BEGIN
  -- First, ensure supabase_user_id is the primary identifier
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'carrier_profiles' 
    AND column_name = 'clerk_user_id'
  ) THEN
    -- Drop any views that depend on clerk_user_id first
    DROP VIEW IF EXISTS user_id_mapping CASCADE;
    
    -- If clerk_user_id is a primary key, we need to drop it and potentially recreate PK
    IF EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE table_name = 'carrier_profiles' 
      AND constraint_type = 'PRIMARY KEY'
      AND constraint_name LIKE '%clerk_user_id%'
    ) THEN
      -- Drop primary key constraint
      ALTER TABLE carrier_profiles DROP CONSTRAINT IF EXISTS carrier_profiles_pkey CASCADE;
      -- Create new primary key on supabase_user_id if it exists and is unique
      IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'carrier_profiles' 
        AND column_name = 'supabase_user_id'
      ) THEN
        ALTER TABLE carrier_profiles ADD PRIMARY KEY (supabase_user_id);
      END IF;
    END IF;
    
    -- Drop any remaining unique constraints on clerk_user_id
    ALTER TABLE carrier_profiles DROP CONSTRAINT IF EXISTS carrier_profiles_clerk_user_id_key CASCADE;
    
    -- Now drop the column with CASCADE to handle any remaining dependencies
    ALTER TABLE carrier_profiles DROP COLUMN IF EXISTS clerk_user_id CASCADE;
    RAISE NOTICE 'Removed clerk_user_id from carrier_profiles';
  END IF;
END $$;

-- Remove clerk_user_id from carrier_bids
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'carrier_bids' 
    AND column_name = 'clerk_user_id'
  ) THEN
    ALTER TABLE carrier_bids DROP COLUMN IF EXISTS clerk_user_id;
    RAISE NOTICE 'Removed clerk_user_id from carrier_bids';
  END IF;
END $$;

-- Remove clerk_user_id from user_roles_cache (may be PRIMARY KEY)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_roles_cache' 
    AND column_name = 'clerk_user_id'
  ) THEN
    -- Handle primary key if clerk_user_id is PK
    IF EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE table_name = 'user_roles_cache' 
      AND constraint_type = 'PRIMARY KEY'
      AND constraint_name LIKE '%clerk_user_id%'
    ) THEN
      ALTER TABLE user_roles_cache DROP CONSTRAINT user_roles_cache_pkey;
      -- Create new primary key on supabase_user_id
      IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_roles_cache' 
        AND column_name = 'supabase_user_id'
      ) THEN
        ALTER TABLE user_roles_cache ADD PRIMARY KEY (supabase_user_id);
      END IF;
    END IF;
    
    ALTER TABLE user_roles_cache DROP COLUMN IF EXISTS clerk_user_id;
    RAISE NOTICE 'Removed clerk_user_id from user_roles_cache';
  END IF;
END $$;

-- Remove winner_user_id from auction_awards (Clerk reference)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'auction_awards' 
    AND column_name = 'winner_user_id'
  ) THEN
    ALTER TABLE auction_awards DROP COLUMN IF EXISTS winner_user_id;
    RAISE NOTICE 'Removed winner_user_id from auction_awards';
  END IF;
END $$;

-- Remove awarded_by from auction_awards if it's Clerk-based (check if supabase_awarded_by exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'auction_awards' 
    AND column_name = 'awarded_by'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'auction_awards' 
    AND column_name = 'supabase_awarded_by'
  ) THEN
    ALTER TABLE auction_awards DROP COLUMN IF EXISTS awarded_by;
    RAISE NOTICE 'Removed awarded_by from auction_awards';
  END IF;
END $$;

-- Remove clerk-based user ID columns from other tables
DO $$
DECLARE
  table_record RECORD;
  column_record RECORD;
BEGIN
  -- List of tables that might have clerk_user_id or similar columns
  FOR table_record IN (
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
    AND table_name IN (
      'conversations',
      'conversation_messages',
      'message_reads',
      'carrier_chat_messages',
      'admin_messages',
      'load_offers',
      'assignments',
      'telegram_bid_offers',
      'carrier_bid_history',
      'notification_triggers',
      'notification_logs',
      'carrier_favorites',
      'carrier_notification_preferences',
      'bid_messages',
      'carrier_responses',
      'appeal_conversations'
    )
  ) LOOP
    -- Check for clerk_user_id column
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = table_record.table_name 
      AND column_name = 'clerk_user_id'
      AND column_name NOT IN (
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = table_record.table_name 
        AND column_name LIKE 'supabase%'
      )
    ) THEN
      EXECUTE format('ALTER TABLE %I DROP COLUMN IF EXISTS clerk_user_id', table_record.table_name);
      RAISE NOTICE 'Removed clerk_user_id from %', table_record.table_name;
    END IF;
    
    -- Check for carrier_user_id column (may be Clerk-based)
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = table_record.table_name 
      AND column_name = 'carrier_user_id'
      AND EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = table_record.table_name 
        AND column_name = 'supabase_carrier_user_id'
      )
    ) THEN
      EXECUTE format('ALTER TABLE %I DROP COLUMN IF EXISTS carrier_user_id', table_record.table_name);
      RAISE NOTICE 'Removed carrier_user_id from %', table_record.table_name;
    END IF;
    
    -- Check for admin_user_id column
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = table_record.table_name 
      AND column_name = 'admin_user_id'
      AND EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = table_record.table_name 
        AND column_name = 'supabase_admin_user_id'
      )
    ) THEN
      EXECUTE format('ALTER TABLE %I DROP COLUMN IF EXISTS admin_user_id', table_record.table_name);
      RAISE NOTICE 'Removed admin_user_id from %', table_record.table_name;
    END IF;
    
    -- Check for sender_id column
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = table_record.table_name 
      AND column_name = 'sender_id'
      AND EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = table_record.table_name 
        AND column_name = 'supabase_sender_id'
      )
    ) THEN
      EXECUTE format('ALTER TABLE %I DROP COLUMN IF EXISTS sender_id', table_record.table_name);
      RAISE NOTICE 'Removed sender_id from %', table_record.table_name;
    END IF;
    
    -- Check for generic user_id column (if supabase_user_id exists)
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = table_record.table_name 
      AND column_name = 'user_id'
      AND EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = table_record.table_name 
        AND column_name = 'supabase_user_id'
      )
      AND table_record.table_name NOT IN ('user_roles', 'assignments') -- Keep user_id for these if needed
    ) THEN
      EXECUTE format('ALTER TABLE %I DROP COLUMN IF EXISTS user_id', table_record.table_name);
      RAISE NOTICE 'Removed user_id from %', table_record.table_name;
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- STEP 4: Update any remaining constraints and ensure proper structure
-- ============================================================================

-- Ensure supabase_user_id is NOT NULL where it should be (after migration)
-- Note: This should be done carefully after verifying all data is migrated

-- Update comments to remove Clerk references
COMMENT ON COLUMN carrier_profiles.supabase_user_id IS 'Supabase user ID - primary identifier for carrier profile';
COMMENT ON COLUMN user_roles_cache.supabase_user_id IS 'Supabase user ID - primary identifier for user role';

COMMIT;

-- Display summary
DO $$
BEGIN
  RAISE NOTICE '✅ Migration complete: All clerk_user_id columns have been removed';
  RAISE NOTICE '⚠️  Ensure all application code now uses supabase_user_id only';
END $$;

