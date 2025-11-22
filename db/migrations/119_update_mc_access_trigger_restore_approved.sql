-- Migration 119: Update MC Access Control Trigger to Restore Carriers to Approved
-- Description: When MC is enabled, restore carriers that were declined due to MC disable back to 'approved'
-- This ensures carriers are fully re-enabled when their MC is re-enabled

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
  
  -- When an MC is enabled, restore all carriers that were declined due to MC disable
  -- Restore them to 'approved' status (re-enable all at once as requested)
  IF NEW.is_active = true AND OLD.is_active = false THEN
    UPDATE carrier_profiles
    SET 
      profile_status = 'approved',
      decline_reason = NULL,
      reviewed_at = NOW(),
      reviewed_by = NEW.enabled_by,
      updated_at = NOW()
    WHERE mc_number = NEW.mc_number
    AND profile_status = 'declined'
    AND (decline_reason LIKE '%MC access disabled%' OR decline_reason LIKE '%DNU by USPS%');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION disable_carriers_for_mc() IS 'Automatically manages carrier profile status when MC access is enabled/disabled. When disabled, sets all carriers to declined. When enabled, restores all carriers that were declined due to MC disable back to approved status.';

