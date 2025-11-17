-- Migration 113: MC Access Control System
-- Description: Central control system to enable/disable access for carriers by MC number

-- Create table to store MC access control states
CREATE TABLE IF NOT EXISTS mc_access_control (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mc_number TEXT NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT true, -- true = active (blue), false = disabled (red)
    disabled_reason TEXT DEFAULT 'DNU by USPS', -- Reason for disabling
    disabled_by TEXT, -- Admin user_id who disabled it
    disabled_at TIMESTAMP WITH TIME ZONE,
    enabled_by TEXT, -- Admin user_id who enabled it
    enabled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_mc_access_control_mc_number ON mc_access_control(mc_number);
CREATE INDEX IF NOT EXISTS idx_mc_access_control_is_active ON mc_access_control(is_active);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_mc_access_control_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS trigger_update_mc_access_control_updated_at ON mc_access_control;
CREATE TRIGGER trigger_update_mc_access_control_updated_at
    BEFORE UPDATE ON mc_access_control
    FOR EACH ROW
    EXECUTE FUNCTION update_mc_access_control_updated_at();

-- Function to automatically disable all carriers with a disabled MC
CREATE OR REPLACE FUNCTION disable_carriers_for_mc()
RETURNS TRIGGER AS $$
BEGIN
    -- When an MC is disabled, set all carrier profiles with that MC to 'declined'
    IF NEW.is_active = false AND (OLD.is_active IS NULL OR OLD.is_active = true) THEN
        UPDATE carrier_profiles
        SET 
            profile_status = 'declined',
            decline_reason = COALESCE(NEW.disabled_reason, 'MC access disabled by admin'),
            reviewed_at = NOW(),
            reviewed_by = NEW.disabled_by,
            updated_at = NOW()
        WHERE mc_number = NEW.mc_number
        AND profile_status != 'declined';
    END IF;
    
    -- When an MC is enabled, we don't auto-approve carriers (they need manual review)
    -- But we can set them back to 'pending' if they were declined due to MC disable
    IF NEW.is_active = true AND OLD.is_active = false THEN
        UPDATE carrier_profiles
        SET 
            profile_status = 'pending',
            decline_reason = NULL,
            reviewed_at = NULL,
            reviewed_by = NULL,
            updated_at = NOW()
        WHERE mc_number = NEW.mc_number
        AND profile_status = 'declined'
        AND decline_reason LIKE '%MC access disabled%';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update carrier profiles when MC access changes
DROP TRIGGER IF EXISTS trigger_disable_carriers_for_mc ON mc_access_control;
CREATE TRIGGER trigger_disable_carriers_for_mc
    AFTER UPDATE OF is_active ON mc_access_control
    FOR EACH ROW
    EXECUTE FUNCTION disable_carriers_for_mc();

COMMENT ON TABLE mc_access_control IS 'Central control system for MC number access. When disabled, all carriers with that MC lose access.';
COMMENT ON COLUMN mc_access_control.is_active IS 'true = active (blue), false = disabled (red)';
COMMENT ON COLUMN mc_access_control.disabled_reason IS 'Reason for disabling (default: DNU by USPS)';

