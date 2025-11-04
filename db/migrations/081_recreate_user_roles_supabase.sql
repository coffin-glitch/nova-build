-- Migration 081: Recreate user_roles table for Supabase compatibility
-- Description: Recreates user_roles table to work with Supabase auth
-- This table is used for quick stats queries and can be kept in sync with user_roles_cache

BEGIN;

-- Create user_roles table (Supabase-compatible)
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supabase_user_id TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'carrier')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster role-based queries
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);
CREATE INDEX IF NOT EXISTS idx_user_roles_supabase_user_id ON user_roles(supabase_user_id);

-- Sync existing data from user_roles_cache
INSERT INTO user_roles (supabase_user_id, role, created_at)
SELECT 
    urc.supabase_user_id,
    urc.role,
    urc.created_at
FROM user_roles_cache urc
WHERE urc.supabase_user_id IS NOT NULL
    AND urc.role IN ('admin', 'carrier')
ON CONFLICT (supabase_user_id) DO NOTHING;

-- Create a function to sync user_roles from user_roles_cache
CREATE OR REPLACE FUNCTION sync_user_roles_from_cache()
RETURNS void AS $$
BEGIN
    -- Insert or update from user_roles_cache
    INSERT INTO user_roles (supabase_user_id, role, created_at)
    SELECT 
        urc.supabase_user_id,
        urc.role,
        urc.created_at
    FROM user_roles_cache urc
    WHERE urc.supabase_user_id IS NOT NULL
        AND urc.role IN ('admin', 'carrier')
    ON CONFLICT (supabase_user_id) 
    DO UPDATE SET 
        role = EXCLUDED.role;
    
    -- Delete records that no longer exist in user_roles_cache
    DELETE FROM user_roles ur
    WHERE NOT EXISTS (
        SELECT 1 FROM user_roles_cache urc 
        WHERE urc.supabase_user_id = ur.supabase_user_id
    );
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to auto-sync when user_roles_cache changes
-- Note: This is a simple approach - for production, consider using a more sophisticated sync mechanism
CREATE OR REPLACE FUNCTION trigger_sync_user_roles()
RETURNS TRIGGER AS $$
BEGIN
    -- Sync on insert/update/delete
    PERFORM sync_user_roles_from_cache();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS sync_user_roles_trigger ON user_roles_cache;
CREATE TRIGGER sync_user_roles_trigger
    AFTER INSERT OR UPDATE OR DELETE ON user_roles_cache
    FOR EACH STATEMENT
    EXECUTE FUNCTION trigger_sync_user_roles();

-- Add comments
COMMENT ON TABLE user_roles IS 'User roles table - synced from user_roles_cache for quick stats queries. Supabase-compatible.';
COMMENT ON COLUMN user_roles.supabase_user_id IS 'Supabase user ID - unique identifier';
COMMENT ON COLUMN user_roles.role IS 'User role: admin or carrier';

COMMIT;

DO $$
BEGIN
  RAISE NOTICE '✅ Migration complete: user_roles table recreated for Supabase compatibility';
  RAISE NOTICE '📊 Synced % records from user_roles_cache', (SELECT COUNT(*) FROM user_roles);
END $$;


