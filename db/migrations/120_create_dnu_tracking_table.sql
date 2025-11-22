-- Migration 120: DNU (Do Not Use) Tracking System
-- Description: Tracks MC and DOT numbers from USPS DNU list with status and dates

-- Create table to store DNU entries
CREATE TABLE IF NOT EXISTS dnu_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mc_number TEXT,
    dot_number TEXT,
    carrier_name TEXT, -- Carrier name from the DNU list (if available)
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'removed')),
    added_to_dnu_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    removed_from_dnu_at TIMESTAMP WITH TIME ZONE,
    last_upload_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    -- Ensure at least one of MC or DOT is provided
    CONSTRAINT dnu_has_mc_or_dot CHECK (mc_number IS NOT NULL OR dot_number IS NOT NULL),
    -- Unique constraint on MC+DOT combination
    CONSTRAINT dnu_unique_mc_dot UNIQUE (mc_number, dot_number)
);

-- Indexes for quick lookups
CREATE INDEX IF NOT EXISTS idx_dnu_tracking_mc_number ON dnu_tracking(mc_number) WHERE mc_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dnu_tracking_dot_number ON dnu_tracking(dot_number) WHERE dot_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dnu_tracking_status ON dnu_tracking(status);
CREATE INDEX IF NOT EXISTS idx_dnu_tracking_added_at ON dnu_tracking(added_to_dnu_at DESC);
CREATE INDEX IF NOT EXISTS idx_dnu_tracking_removed_at ON dnu_tracking(removed_from_dnu_at DESC);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_dnu_tracking_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS trigger_update_dnu_tracking_updated_at ON dnu_tracking;
CREATE TRIGGER trigger_update_dnu_tracking_updated_at
    BEFORE UPDATE ON dnu_tracking
    FOR EACH ROW
    EXECUTE FUNCTION update_dnu_tracking_updated_at();

COMMENT ON TABLE dnu_tracking IS 'Tracks MC and DOT numbers from USPS DNU list. Status: active = currently on DNU list, removed = was on list but removed in latest upload.';
COMMENT ON COLUMN dnu_tracking.status IS 'active = currently on DNU list, removed = was removed from DNU list in latest upload';
COMMENT ON COLUMN dnu_tracking.added_to_dnu_at IS 'Date when this MC/DOT was first added to DNU list';
COMMENT ON COLUMN dnu_tracking.removed_from_dnu_at IS 'Date when this MC/DOT was removed from DNU list (status changed to removed)';
COMMENT ON COLUMN dnu_tracking.last_upload_date IS 'Date of the last upload that included or removed this entry';

