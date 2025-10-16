-- Add driver information fields to load_offers table
-- This allows carriers to input driver details after their offer is accepted

ALTER TABLE load_offers 
ADD COLUMN IF NOT EXISTS driver_name TEXT,
ADD COLUMN IF NOT EXISTS driver_phone TEXT,
ADD COLUMN IF NOT EXISTS driver_email TEXT,
ADD COLUMN IF NOT EXISTS driver_license_number TEXT,
ADD COLUMN IF NOT EXISTS driver_license_state TEXT,
ADD COLUMN IF NOT EXISTS truck_number TEXT,
ADD COLUMN IF NOT EXISTS trailer_number TEXT,
ADD COLUMN IF NOT EXISTS driver_info_submitted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS driver_info_required BOOLEAN DEFAULT false;

-- Add index for driver info queries
CREATE INDEX IF NOT EXISTS idx_load_offers_driver_info ON load_offers(driver_info_submitted_at);

-- Add comment to explain the workflow
COMMENT ON COLUMN load_offers.driver_info_required IS 'Set to true when admin accepts offer and requires driver info';
COMMENT ON COLUMN load_offers.driver_info_submitted_at IS 'Timestamp when carrier submitted driver information';
