-- Migration: Create admin_profiles table
-- Purpose: Store masked admin personal information separate from system user data
-- Created: 2025-01-XX

CREATE TABLE IF NOT EXISTS admin_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supabase_user_id TEXT NOT NULL UNIQUE,
    
    -- Display Information (what admins want to show)
    display_name TEXT,
    display_email TEXT,
    display_phone TEXT,
    title TEXT, -- e.g., "Senior Administrator", "Operations Manager"
    department TEXT, -- e.g., "Operations", "Support", "Management"
    bio TEXT, -- Short bio/description
    
    -- Contact Preferences
    preferred_contact_method TEXT DEFAULT 'email', -- 'email', 'phone', 'both'
    notification_preferences JSONB DEFAULT '{}'::jsonb,
    
    -- Profile Settings
    avatar_url TEXT,
    theme_preference TEXT DEFAULT 'system', -- 'light', 'dark', 'system'
    language_preference TEXT DEFAULT 'en',
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Foreign key reference (optional, for data integrity)
    CONSTRAINT fk_admin_user FOREIGN KEY (supabase_user_id) 
        REFERENCES user_roles_cache(supabase_user_id) ON DELETE CASCADE
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_admin_profiles_user_id ON admin_profiles(supabase_user_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_admin_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_admin_profiles_updated_at
    BEFORE UPDATE ON admin_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_admin_profiles_updated_at();

-- Add comment
COMMENT ON TABLE admin_profiles IS 'Stores masked admin profile information separate from system authentication data';

