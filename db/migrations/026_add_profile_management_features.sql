-- Migration to add profile ordering and management features
-- This adds support for drag-and-drop ordering and better profile management

-- Add a display_order column for drag-and-drop functionality
ALTER TABLE driver_profiles 
ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- Add a last_used_at column to track profile usage
ALTER TABLE driver_profiles 
ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMP WITH TIME ZONE;

-- Create an index for better performance on ordering
CREATE INDEX IF NOT EXISTS idx_driver_profiles_display_order 
ON driver_profiles(carrier_user_id, display_order);

-- Create a function to update profile display order
CREATE OR REPLACE FUNCTION update_profile_display_order(
    p_carrier_user_id VARCHAR(255),
    p_profile_orders JSONB
) RETURNS BOOLEAN AS $$
DECLARE
    profile_item JSONB;
BEGIN
    -- Update display order for each profile
    FOR profile_item IN SELECT * FROM jsonb_array_elements(p_profile_orders)
    LOOP
        UPDATE driver_profiles 
        SET display_order = (profile_item->>'order')::INTEGER,
            updated_at = CURRENT_TIMESTAMP
        WHERE carrier_user_id = p_carrier_user_id 
        AND id = (profile_item->>'id')::UUID;
    END LOOP;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Create a function to update profile name without changing other data
CREATE OR REPLACE FUNCTION update_profile_name(
    p_profile_id UUID,
    p_carrier_user_id VARCHAR(255),
    p_new_name VARCHAR(255)
) RETURNS BOOLEAN AS $$
DECLARE
    existing_count INTEGER;
BEGIN
    -- Check if the new name already exists for this carrier
    SELECT COUNT(*) INTO existing_count
    FROM driver_profiles 
    WHERE carrier_user_id = p_carrier_user_id 
    AND profile_name = p_new_name
    AND id != p_profile_id
    AND is_active = true;
    
    IF existing_count > 0 THEN
        RETURN FALSE; -- Name already exists
    END IF;
    
    -- Update the profile name
    UPDATE driver_profiles 
    SET profile_name = p_new_name,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_profile_id 
    AND carrier_user_id = p_carrier_user_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Create a function to mark profile as used (for usage tracking)
CREATE OR REPLACE FUNCTION mark_profile_used(
    p_profile_id UUID,
    p_carrier_user_id VARCHAR(255)
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE driver_profiles 
    SET last_used_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_profile_id 
    AND carrier_user_id = p_carrier_user_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Add comments for the new functions
COMMENT ON FUNCTION update_profile_display_order IS 
'Updates the display order of multiple driver profiles for drag-and-drop functionality.';

COMMENT ON FUNCTION update_profile_name IS 
'Updates only the profile name without changing other driver information. Returns false if name already exists.';

COMMENT ON FUNCTION mark_profile_used IS 
'Tracks when a profile was last used for better organization and usage analytics.';

COMMENT ON COLUMN driver_profiles.display_order IS 
'Order for displaying profiles in the UI. Lower numbers appear first.';

COMMENT ON COLUMN driver_profiles.last_used_at IS 
'Timestamp when this profile was last used to load driver information.';
