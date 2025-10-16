-- Migration to improve driver profiles unique constraint handling
-- This allows multiple drivers with the same name but prevents true duplicates

-- First, remove the existing unique constraint on profile_name
-- (We'll add a composite constraint instead)

-- Add a composite unique constraint that prevents true duplicates
-- This allows multiple profiles with the same name as long as they have different
-- phone numbers or license numbers, which is realistic in the trucking industry
ALTER TABLE driver_profiles 
ADD CONSTRAINT unique_driver_profile_per_carrier 
UNIQUE (carrier_user_id, driver_name, driver_phone, driver_license_number);

-- Add an index for better performance on the composite constraint
CREATE INDEX IF NOT EXISTS idx_driver_profiles_composite_unique 
ON driver_profiles(carrier_user_id, driver_name, driver_phone, driver_license_number);

-- Add a function to generate unique profile names when duplicates are detected
CREATE OR REPLACE FUNCTION generate_unique_profile_name(
    p_carrier_user_id VARCHAR(255),
    p_driver_name VARCHAR(255),
    p_driver_phone VARCHAR(20),
    p_driver_license_number VARCHAR(50)
) RETURNS VARCHAR(255) AS $$
DECLARE
    base_name VARCHAR(255);
    counter INTEGER := 1;
    unique_name VARCHAR(255);
    phone_suffix VARCHAR(10);
    license_suffix VARCHAR(10);
BEGIN
    -- Create base name from driver name
    base_name := TRIM(p_driver_name);
    
    -- Add phone suffix if available (last 4 digits)
    IF p_driver_phone IS NOT NULL AND LENGTH(p_driver_phone) >= 4 THEN
        phone_suffix := RIGHT(p_driver_phone, 4);
        base_name := base_name || ' (' || phone_suffix || ')';
    END IF;
    
    -- Add license suffix if available (last 4 characters)
    IF p_driver_license_number IS NOT NULL AND LENGTH(p_driver_license_number) >= 4 THEN
        license_suffix := RIGHT(p_driver_license_number, 4);
        base_name := base_name || ' - ' || license_suffix;
    END IF;
    
    -- Check if this name already exists and increment counter if needed
    unique_name := base_name;
    
    WHILE EXISTS (
        SELECT 1 FROM driver_profiles 
        WHERE carrier_user_id = p_carrier_user_id 
        AND profile_name = unique_name 
        AND is_active = true
    ) LOOP
        counter := counter + 1;
        unique_name := base_name || ' #' || counter;
    END LOOP;
    
    RETURN unique_name;
END;
$$ LANGUAGE plpgsql;

-- Add comments for the new constraint
COMMENT ON CONSTRAINT unique_driver_profile_per_carrier ON driver_profiles IS 
'Prevents duplicate driver profiles within the same carrier. Allows multiple drivers with the same name as long as they have different phone numbers or license numbers.';

COMMENT ON FUNCTION generate_unique_profile_name IS 
'Generates unique profile names by combining driver name with phone/license suffixes and adding counters when needed.';
