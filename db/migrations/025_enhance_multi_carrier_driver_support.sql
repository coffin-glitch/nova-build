-- Enhanced migration for multi-carrier driver profile support
-- This adds better handling for drivers who work with multiple carriers

-- Add a function to generate carrier-aware unique profile names
CREATE OR REPLACE FUNCTION generate_carrier_aware_profile_name(
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
    carrier_suffix VARCHAR(20);
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
    
    -- Add carrier context suffix (last 6 characters of carrier_user_id)
    IF p_carrier_user_id IS NOT NULL AND LENGTH(p_carrier_user_id) >= 6 THEN
        carrier_suffix := RIGHT(p_carrier_user_id, 6);
        base_name := base_name || ' [' || carrier_suffix || ']';
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

-- Add a function to check for potential cross-carrier duplicates
CREATE OR REPLACE FUNCTION check_cross_carrier_driver(
    p_carrier_user_id VARCHAR(255),
    p_driver_name VARCHAR(255),
    p_driver_phone VARCHAR(20),
    p_driver_license_number VARCHAR(50)
) RETURNS TABLE(
    other_carrier_id VARCHAR(255),
    profile_name VARCHAR(255),
    similarity_score INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        dp.carrier_user_id as other_carrier_id,
        dp.profile_name,
        CASE 
            WHEN dp.driver_name = p_driver_name AND dp.driver_phone = p_driver_phone AND dp.driver_license_number = p_driver_license_number THEN 100
            WHEN dp.driver_name = p_driver_name AND dp.driver_phone = p_driver_phone THEN 80
            WHEN dp.driver_name = p_driver_name AND dp.driver_license_number = p_driver_license_number THEN 70
            WHEN dp.driver_name = p_driver_name THEN 50
            ELSE 0
        END as similarity_score
    FROM driver_profiles dp
    WHERE dp.carrier_user_id != p_carrier_user_id
    AND dp.is_active = true
    AND (
        dp.driver_name = p_driver_name 
        OR dp.driver_phone = p_driver_phone 
        OR dp.driver_license_number = p_driver_license_number
    )
    ORDER BY similarity_score DESC;
END;
$$ LANGUAGE plpgsql;

-- Add a function to suggest profile names based on existing patterns
CREATE OR REPLACE FUNCTION suggest_profile_names(
    p_carrier_user_id VARCHAR(255),
    p_driver_name VARCHAR(255),
    p_driver_phone VARCHAR(20),
    p_driver_license_number VARCHAR(50)
) RETURNS TABLE(
    suggested_name VARCHAR(255),
    reason VARCHAR(255)
) AS $$
DECLARE
    base_name VARCHAR(255);
    phone_suffix VARCHAR(10);
    license_suffix VARCHAR(10);
    carrier_suffix VARCHAR(20);
BEGIN
    base_name := TRIM(p_driver_name);
    
    -- Suggestion 1: Just the driver name
    RETURN QUERY SELECT base_name, 'Simple driver name'::VARCHAR(255);
    
    -- Suggestion 2: Driver name + phone suffix
    IF p_driver_phone IS NOT NULL AND LENGTH(p_driver_phone) >= 4 THEN
        phone_suffix := RIGHT(p_driver_phone, 4);
        RETURN QUERY SELECT base_name || ' (' || phone_suffix || ')', 'Driver name with phone suffix'::VARCHAR(255);
    END IF;
    
    -- Suggestion 3: Driver name + license suffix
    IF p_driver_license_number IS NOT NULL AND LENGTH(p_driver_license_number) >= 4 THEN
        license_suffix := RIGHT(p_driver_license_number, 4);
        RETURN QUERY SELECT base_name || ' - ' || license_suffix, 'Driver name with license suffix'::VARCHAR(255);
    END IF;
    
    -- Suggestion 4: Driver name + phone + license
    IF p_driver_phone IS NOT NULL AND LENGTH(p_driver_phone) >= 4 AND 
       p_driver_license_number IS NOT NULL AND LENGTH(p_driver_license_number) >= 4 THEN
        phone_suffix := RIGHT(p_driver_phone, 4);
        license_suffix := RIGHT(p_driver_license_number, 4);
        RETURN QUERY SELECT base_name || ' (' || phone_suffix || ') - ' || license_suffix, 'Driver name with phone and license suffixes'::VARCHAR(255);
    END IF;
    
    -- Suggestion 5: Driver name + carrier context
    IF p_carrier_user_id IS NOT NULL AND LENGTH(p_carrier_user_id) >= 6 THEN
        carrier_suffix := RIGHT(p_carrier_user_id, 6);
        RETURN QUERY SELECT base_name || ' [' || carrier_suffix || ']', 'Driver name with carrier context'::VARCHAR(255);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Add comments for the new functions
COMMENT ON FUNCTION generate_carrier_aware_profile_name IS 
'Generates unique profile names with carrier context awareness. Includes phone/license suffixes and carrier identifiers to prevent conflicts across carriers.';

COMMENT ON FUNCTION check_cross_carrier_driver IS 
'Checks for potential duplicate drivers across different carriers. Returns similarity scores to help identify the same driver working for multiple carriers.';

COMMENT ON FUNCTION suggest_profile_names IS 
'Provides multiple profile name suggestions based on driver information. Helps users choose appropriate names that avoid conflicts.';
