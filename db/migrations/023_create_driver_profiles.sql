-- Create driver profiles table for carriers to save reusable driver information
CREATE TABLE IF NOT EXISTS driver_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    carrier_user_id VARCHAR(255) NOT NULL,
    profile_name VARCHAR(255) NOT NULL,
    driver_name VARCHAR(255) NOT NULL,
    driver_phone VARCHAR(20) NOT NULL,
    driver_email VARCHAR(255),
    driver_license_number VARCHAR(50),
    driver_license_state VARCHAR(10),
    truck_number VARCHAR(50),
    trailer_number VARCHAR(50),
    second_driver_name VARCHAR(255),
    second_driver_phone VARCHAR(20),
    second_driver_email VARCHAR(255),
    second_driver_license_number VARCHAR(50),
    second_driver_license_state VARCHAR(10),
    second_truck_number VARCHAR(50),
    second_trailer_number VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_driver_profiles_carrier_user_id ON driver_profiles(carrier_user_id);
CREATE INDEX IF NOT EXISTS idx_driver_profiles_active ON driver_profiles(is_active);
CREATE INDEX IF NOT EXISTS idx_driver_profiles_profile_name ON driver_profiles(profile_name);

-- Add foreign key constraint (if users table exists)
-- ALTER TABLE driver_profiles ADD CONSTRAINT fk_driver_profiles_carrier_user_id 
-- FOREIGN KEY (carrier_user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Add comments for documentation
COMMENT ON TABLE driver_profiles IS 'Stores reusable driver profiles for carriers';
COMMENT ON COLUMN driver_profiles.profile_name IS 'User-defined name for the driver profile (e.g., "John Smith - Primary Driver")';
COMMENT ON COLUMN driver_profiles.driver_phone IS '10-digit phone number without formatting';
COMMENT ON COLUMN driver_profiles.truck_number IS 'Truck identifier (no length restrictions)';
COMMENT ON COLUMN driver_profiles.trailer_number IS 'Trailer identifier (no length restrictions)';
COMMENT ON COLUMN driver_profiles.is_active IS 'Whether the profile is available for selection';

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_driver_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_driver_profiles_updated_at
    BEFORE UPDATE ON driver_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_driver_profiles_updated_at();
