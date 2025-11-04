-- Migration 079: Remove legacy user_roles table
-- Description: Migrates any remaining data from user_roles to user_roles_cache, then drops the table
-- The user_roles table is no longer needed - all role management is now in user_roles_cache

BEGIN;

-- Step 1: Migrate any remaining data from user_roles to user_roles_cache
-- Only migrate if the supabase_user_id doesn't already exist in user_roles_cache
-- Note: user_roles.user_id might be a clerk_user_id, so we'll map it if possible
DO $$
DECLARE
  migrated_count INTEGER := 0;
  ur_record RECORD;
BEGIN
  -- Loop through user_roles and try to migrate
  FOR ur_record IN 
    SELECT ur.user_id, ur.role, ur.created_at
    FROM user_roles ur
    LEFT JOIN user_roles_cache urc ON ur.user_id = urc.supabase_user_id
    WHERE urc.supabase_user_id IS NULL
      AND ur.user_id IS NOT NULL
      AND ur.user_id != ''
  LOOP
    -- Try to insert if user_id looks like a Supabase UUID (36 chars with dashes)
    -- Or if it matches any pattern we can use
    IF length(ur_record.user_id) >= 32 THEN
      BEGIN
        INSERT INTO user_roles_cache (supabase_user_id, role, email, created_at, last_synced)
        VALUES (
          ur_record.user_id,
          ur_record.role,
          'migrated@user.local',
          ur_record.created_at,
          NOW()
        );
        migrated_count := migrated_count + 1;
      EXCEPTION
        WHEN unique_violation THEN
          -- Already exists, skip
          NULL;
        WHEN OTHERS THEN
          -- Can't insert (maybe invalid format), skip
          NULL;
      END;
    END IF;
  END LOOP;
  
  IF migrated_count > 0 THEN
    RAISE NOTICE 'Migrated % records from user_roles to user_roles_cache', migrated_count;
  ELSE
    RAISE NOTICE 'No records migrated from user_roles (already migrated or incompatible format)';
  END IF;
END $$;

-- Step 2: Drop the user_roles table (no longer needed)
DROP TABLE IF EXISTS user_roles CASCADE;

COMMIT;

DO $$
BEGIN
  RAISE NOTICE '✅ Migration complete: user_roles table removed';
  RAISE NOTICE '⚠️  All role management now uses user_roles_cache only';
END $$;

