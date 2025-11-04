-- Migration: Add 'open' status to carrier profile status constraint
-- Description: Allows 'open' status for profiles that need setup or edits

-- Drop the existing constraint
ALTER TABLE carrier_profiles DROP CONSTRAINT IF EXISTS carrier_profiles_profile_status_check;

-- Add new constraint with 'open' status
ALTER TABLE carrier_profiles ADD CONSTRAINT carrier_profiles_profile_status_check 
CHECK (profile_status IN ('pending', 'approved', 'declined', 'open'));

-- Update the workflow constraint to allow 'open' status without requiring submitted_at
ALTER TABLE carrier_profiles DROP CONSTRAINT IF EXISTS check_profile_workflow;

ALTER TABLE carrier_profiles ADD CONSTRAINT check_profile_workflow 
CHECK (
    (profile_status = 'open') OR
    (profile_status = 'pending' AND submitted_at IS NOT NULL) OR
    (profile_status = 'approved' AND submitted_at IS NOT NULL AND reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL) OR
    (profile_status = 'declined' AND submitted_at IS NOT NULL AND reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL AND decline_reason IS NOT NULL)
);


