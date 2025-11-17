-- Highway Carrier Data Cache Table
-- Stores scraped carrier data from Highway.com to avoid repeated scraping

CREATE TABLE IF NOT EXISTS highway_carrier_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mc_number TEXT NOT NULL,
    carrier_name TEXT NOT NULL,
    carrier_id TEXT NOT NULL,
    carrier_url TEXT NOT NULL,
    scraped_data JSONB NOT NULL,
    scraped_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(mc_number, carrier_id)
);

-- Index for quick lookups by MC number
CREATE INDEX IF NOT EXISTS idx_highway_carrier_data_mc_number ON highway_carrier_data(mc_number);

-- Index for lookups by carrier_id
CREATE INDEX IF NOT EXISTS idx_highway_carrier_data_carrier_id ON highway_carrier_data(carrier_id);

-- Index for checking freshness (scraped_at)
CREATE INDEX IF NOT EXISTS idx_highway_carrier_data_scraped_at ON highway_carrier_data(scraped_at);

COMMENT ON TABLE highway_carrier_data IS 'Cached carrier health data scraped from Highway.com';
COMMENT ON COLUMN highway_carrier_data.scraped_data IS 'JSON object containing all scraped carrier health metrics and information';

