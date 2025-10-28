-- Migration: Carrier Profile Approval Workflow
-- Description: Implements comprehensive profile approval system with admin review, history tracking, and access control

-- Add approval workflow fields to carrier_profiles
ALTER TABLE carrier_profiles ADD COLUMN IF NOT EXISTS profile_status TEXT DEFAULT 'pending' CHECK (profile_status IN ('pending', 'approved', 'declined'));
ALTER TABLE carrier_profiles ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP;
ALTER TABLE carrier_profiles ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP;
ALTER TABLE carrier_profiles ADD COLUMN IF NOT EXISTS reviewed_by TEXT; -- admin user_id who reviewed
ALTER TABLE carrier_profiles ADD COLUMN IF NOT EXISTS review_notes TEXT; -- admin notes for approval/decline
ALTER TABLE carrier_profiles ADD COLUMN IF NOT EXISTS decline_reason TEXT; -- specific reason for decline
ALTER TABLE carrier_profiles ADD COLUMN IF NOT EXISTS is_first_login BOOLEAN DEFAULT true; -- tracks if user has completed first login profile
ALTER TABLE carrier_profiles ADD COLUMN IF NOT EXISTS profile_completed_at TIMESTAMP; -- when profile was first completed
ALTER TABLE carrier_profiles ADD COLUMN IF NOT EXISTS edits_enabled BOOLEAN DEFAULT false; -- admin can enable/disable profile edits
ALTER TABLE carrier_profiles ADD COLUMN IF NOT EXISTS edits_enabled_by TEXT; -- admin who enabled edits
ALTER TABLE carrier_profiles ADD COLUMN IF NOT EXISTS edits_enabled_at TIMESTAMP; -- when edits were enabled

-- Create carrier_profile_history table to track all profile changes
CREATE TABLE IF NOT EXISTS carrier_profile_history (
    id SERIAL PRIMARY KEY,
    carrier_user_id TEXT NOT NULL,
    profile_data JSONB NOT NULL, -- stores the complete profile data at time of submission
    profile_status TEXT NOT NULL CHECK (profile_status IN ('pending', 'approved', 'declined')),
    submitted_at TIMESTAMP NOT NULL,
    reviewed_at TIMESTAMP,
    reviewed_by TEXT,
    review_notes TEXT,
    decline_reason TEXT,
    version_number INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create admin_profile_actions table to track admin actions
CREATE TABLE IF NOT EXISTS admin_profile_actions (
    id SERIAL PRIMARY KEY,
    carrier_user_id TEXT NOT NULL,
    admin_user_id TEXT NOT NULL,
    action_type TEXT NOT NULL CHECK (action_type IN ('approve', 'decline', 'enable_edits', 'disable_edits', 'unlock_profile')),
    action_data JSONB, -- stores additional action-specific data
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_carrier_profiles_status ON carrier_profiles(profile_status);
CREATE INDEX IF NOT EXISTS idx_carrier_profiles_first_login ON carrier_profiles(is_first_login);
CREATE INDEX IF NOT EXISTS idx_carrier_profiles_edits_enabled ON carrier_profiles(edits_enabled);
CREATE INDEX IF NOT EXISTS idx_carrier_profiles_reviewed_by ON carrier_profiles(reviewed_by);

CREATE INDEX IF NOT EXISTS idx_carrier_profile_history_user_id ON carrier_profile_history(carrier_user_id);
CREATE INDEX IF NOT EXISTS idx_carrier_profile_history_status ON carrier_profile_history(profile_status);
CREATE INDEX IF NOT EXISTS idx_carrier_profile_history_submitted_at ON carrier_profile_history(submitted_at);

CREATE INDEX IF NOT EXISTS idx_admin_profile_actions_carrier ON admin_profile_actions(carrier_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_profile_actions_admin ON admin_profile_actions(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_profile_actions_type ON admin_profile_actions(action_type);

-- Add comments for documentation
COMMENT ON COLUMN carrier_profiles.profile_status IS 'Current approval status: pending, approved, or declined';
COMMENT ON COLUMN carrier_profiles.submitted_at IS 'When the profile was submitted for review';
COMMENT ON COLUMN carrier_profiles.reviewed_at IS 'When the profile was reviewed by admin';
COMMENT ON COLUMN carrier_profiles.reviewed_by IS 'Admin user ID who reviewed the profile';
COMMENT ON COLUMN carrier_profiles.review_notes IS 'Admin notes for the review decision';
COMMENT ON COLUMN carrier_profiles.decline_reason IS 'Specific reason for decline if applicable';
COMMENT ON COLUMN carrier_profiles.is_first_login IS 'Whether this is the users first login (needs profile completion)';
COMMENT ON COLUMN carrier_profiles.profile_completed_at IS 'When the profile was first completed';
COMMENT ON COLUMN carrier_profiles.edits_enabled IS 'Whether profile edits are currently enabled by admin';
COMMENT ON COLUMN carrier_profiles.edits_enabled_by IS 'Admin user ID who enabled edits';
COMMENT ON COLUMN carrier_profiles.edits_enabled_at IS 'When edits were enabled';

COMMENT ON TABLE carrier_profile_history IS 'Complete history of all profile submissions and their approval status';
COMMENT ON TABLE admin_profile_actions IS 'Audit trail of all admin actions on carrier profiles';

-- Update existing profiles to have default status
UPDATE carrier_profiles 
SET profile_status = 'approved', 
    submitted_at = created_at,
    reviewed_at = created_at,
    is_first_login = false,
    profile_completed_at = created_at
WHERE profile_status IS NULL;

-- Add constraint to ensure proper workflow
ALTER TABLE carrier_profiles ADD CONSTRAINT check_profile_workflow 
CHECK (
    (profile_status = 'pending' AND submitted_at IS NOT NULL) OR
    (profile_status = 'approved' AND submitted_at IS NOT NULL AND reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL) OR
    (profile_status = 'declined' AND submitted_at IS NOT NULL AND reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL AND decline_reason IS NOT NULL)
);
