-- Create user_roles_cache table for centralized role management
CREATE TABLE IF NOT EXISTS user_roles_cache (
  clerk_user_id TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('admin', 'carrier', 'none')),
  email TEXT NOT NULL,
  last_synced TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  clerk_updated_at BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_roles_cache_role ON user_roles_cache(role);
CREATE INDEX IF NOT EXISTS idx_user_roles_cache_email ON user_roles_cache(email);
CREATE INDEX IF NOT EXISTS idx_user_roles_cache_last_synced ON user_roles_cache(last_synced);

-- Migrate existing user_roles data to the new cache table
INSERT INTO user_roles_cache (clerk_user_id, role, email, last_synced, clerk_updated_at)
SELECT 
  clerk_user_id,
  role,
  'unknown@example.com' as email, -- Default email since we don't have it in the old table
  NOW() as last_synced,
  EXTRACT(EPOCH FROM NOW()) * 1000 as clerk_updated_at
FROM user_roles
WHERE clerk_user_id IS NOT NULL
ON CONFLICT (clerk_user_id) DO NOTHING;

-- Add comment to the table
COMMENT ON TABLE user_roles_cache IS 'Centralized cache for user roles synced from Clerk API';
COMMENT ON COLUMN user_roles_cache.clerk_user_id IS 'Clerk user ID (primary key)';
COMMENT ON COLUMN user_roles_cache.role IS 'User role: admin, carrier, or none';
COMMENT ON COLUMN user_roles_cache.email IS 'User email address from Clerk';
COMMENT ON COLUMN user_roles_cache.last_synced IS 'When this record was last synced from Clerk';
COMMENT ON COLUMN user_roles_cache.clerk_updated_at IS 'Timestamp from Clerk when user was last updated';
