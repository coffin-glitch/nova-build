-- Add driver info columns to carrier_bids table
ALTER TABLE carrier_bids 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'awarded',
ADD COLUMN IF NOT EXISTS lifecycle_notes TEXT,
ADD COLUMN IF NOT EXISTS driver_name TEXT,
ADD COLUMN IF NOT EXISTS driver_phone TEXT,
ADD COLUMN IF NOT EXISTS driver_email TEXT,
ADD COLUMN IF NOT EXISTS driver_license_number TEXT,
ADD COLUMN IF NOT EXISTS driver_license_state TEXT,
ADD COLUMN IF NOT EXISTS truck_number TEXT,
ADD COLUMN IF NOT EXISTS trailer_number TEXT,
ADD COLUMN IF NOT EXISTS second_driver_name TEXT,
ADD COLUMN IF NOT EXISTS second_driver_phone TEXT,
ADD COLUMN IF NOT EXISTS second_driver_email TEXT,
ADD COLUMN IF NOT EXISTS second_driver_license_number TEXT,
ADD COLUMN IF NOT EXISTS second_driver_license_state TEXT,
ADD COLUMN IF NOT EXISTS second_truck_number TEXT,
ADD COLUMN IF NOT EXISTS second_trailer_number TEXT,
ADD COLUMN IF NOT EXISTS driver_info_submitted_at TIMESTAMP WITH TIME ZONE;

-- Create indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_carrier_bids_status ON carrier_bids(status);
CREATE INDEX IF NOT EXISTS idx_carrier_bids_driver_name ON carrier_bids(driver_name);
CREATE INDEX IF NOT EXISTS idx_carrier_bids_truck_number ON carrier_bids(truck_number);

-- Add comments
COMMENT ON COLUMN carrier_bids.status IS 'Current status of the bid (awarded, active, completed, cancelled)';
COMMENT ON COLUMN carrier_bids.lifecycle_notes IS 'Notes about the bid lifecycle';
COMMENT ON COLUMN carrier_bids.driver_name IS 'Primary driver name';
COMMENT ON COLUMN carrier_bids.driver_phone IS 'Primary driver phone number';
COMMENT ON COLUMN carrier_bids.driver_email IS 'Primary driver email';
COMMENT ON COLUMN carrier_bids.driver_license_number IS 'Primary driver license number';
COMMENT ON COLUMN carrier_bids.driver_license_state IS 'Primary driver license state';
COMMENT ON COLUMN carrier_bids.truck_number IS 'Primary truck number';
COMMENT ON COLUMN carrier_bids.trailer_number IS 'Primary trailer number';
COMMENT ON COLUMN carrier_bids.second_driver_name IS 'Secondary driver name';
COMMENT ON COLUMN carrier_bids.second_driver_phone IS 'Secondary driver phone number';
COMMENT ON COLUMN carrier_bids.second_driver_email IS 'Secondary driver email';
COMMENT ON COLUMN carrier_bids.second_driver_license_number IS 'Secondary driver license number';
COMMENT ON COLUMN carrier_bids.second_driver_license_state IS 'Secondary driver license state';
COMMENT ON COLUMN carrier_bids.second_truck_number IS 'Secondary truck number';
COMMENT ON COLUMN carrier_bids.second_trailer_number IS 'Secondary trailer number';
COMMENT ON COLUMN carrier_bids.driver_info_submitted_at IS 'When driver information was submitted';
