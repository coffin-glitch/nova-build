-- Migration 080: Fix user_roles_cache for Supabase-only auth
-- Description: 
-- 1. Makes supabase_user_id the PRIMARY KEY (unique identifier)
-- 2. Removes clerk_updated_at column
-- 3. Cleans up invalid users
-- 4. Ensures proper structure for Supabase-only authentication

BEGIN;

-- Step 1: Remove invalid users
DELETE FROM user_roles_cache 
WHERE email = 'migrated@user.local' 
   OR email = 'toukeinc@gmail.com';

-- Step 2: Remove clerk_updated_at column if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_roles_cache' 
    AND column_name = 'clerk_updated_at'
  ) THEN
    ALTER TABLE user_roles_cache DROP COLUMN clerk_updated_at;
    RAISE NOTICE 'Removed clerk_updated_at column from user_roles_cache';
  END IF;
END $$;

-- Step 3: Ensure supabase_user_id is PRIMARY KEY
DO $$
DECLARE
  r RECORD;
BEGIN
  -- Drop existing primary key if it exists (in case it's on a different column)
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'user_roles_cache' 
    AND constraint_type = 'PRIMARY KEY'
  ) THEN
    -- Find and drop the old PK
    FOR r IN (
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'user_roles_cache' 
      AND constraint_type = 'PRIMARY KEY'
    ) LOOP
      EXECUTE format('ALTER TABLE user_roles_cache DROP CONSTRAINT IF EXISTS %I', r.constraint_name);
    END LOOP;
  END IF;
  
  -- Create primary key on supabase_user_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'user_roles_cache' 
    AND constraint_type = 'PRIMARY KEY'
  ) THEN
    -- First ensure supabase_user_id is NOT NULL for all existing records
    -- Delete any records with NULL supabase_user_id
    DELETE FROM user_roles_cache WHERE supabase_user_id IS NULL;
    
    -- Now make it NOT NULL
    ALTER TABLE user_roles_cache ALTER COLUMN supabase_user_id SET NOT NULL;
    
    -- Add primary key
    ALTER TABLE user_roles_cache ADD PRIMARY KEY (supabase_user_id);
    RAISE NOTICE 'Added PRIMARY KEY on supabase_user_id';
  END IF;
END $$;

-- Step 4: Match users by email to get their Supabase user IDs
-- We'll need to manually update these after getting Supabase Auth user IDs
-- For now, delete records with NULL supabase_user_id that we can't match
DELETE FROM user_roles_cache 
WHERE supabase_user_id IS NULL;

-- Step 5: Ensure correct roles
UPDATE user_roles_cache 
SET role = 'admin' 
WHERE email = 'duke@novafreight.io';

UPDATE user_roles_cache 
SET role = 'carrier' 
WHERE email = 'dukeisaac12@gmail.com';

UPDATE user_roles_cache 
SET role = 'carrier' 
WHERE email = 'alamodeunt@gmail.com';

-- Step 6: Update comments
COMMENT ON TABLE user_roles_cache IS 'User roles cache for Supabase authentication - primary source of truth for user roles';
COMMENT ON COLUMN user_roles_cache.supabase_user_id IS 'Supabase user ID - PRIMARY KEY and unique identifier';
COMMENT ON COLUMN user_roles_cache.role IS 'User role: admin, carrier, or none';
COMMENT ON COLUMN user_roles_cache.email IS 'User email address from Supabase Auth';
COMMENT ON COLUMN user_roles_cache.last_synced IS 'When this record was last synced';

COMMIT;

-- Display final state
DO $$
DECLARE
  user_count INTEGER;
  admin_count INTEGER;
  carrier_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO user_count FROM user_roles_cache;
  SELECT COUNT(*) INTO admin_count FROM user_roles_cache WHERE role = 'admin';
  SELECT COUNT(*) INTO carrier_count FROM user_roles_cache WHERE role = 'carrier';
  
  RAISE NOTICE '✅ Migration complete!';
  RAISE NOTICE '📊 User roles cache stats:';
  RAISE NOTICE '   Total users: %', user_count;
  RAISE NOTICE '   Admins: %', admin_count;
  RAISE NOTICE '   Carriers: %', carrier_count;
END $$;

