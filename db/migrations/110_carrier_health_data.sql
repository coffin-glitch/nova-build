-- Carrier Health Data Table
-- Stores parsed Highway.com carrier health information and calculated health scores

CREATE TABLE IF NOT EXISTS carrier_health_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mc_number TEXT NOT NULL,
    carrier_name TEXT,
    carrier_url TEXT NOT NULL,
    
    -- Parsed Overview Data
    overview_html TEXT,
    overview_data JSONB,
    
    -- Parsed Directory Data
    directory_html TEXT,
    directory_data JSONB,
    
    -- Extracted Key Metrics
    bluewire_score NUMERIC(5, 2),
    connection_status TEXT, -- 'Connected', 'Not Connected', 'Unknown'
    assessment_status TEXT, -- 'Pass', 'Partial Pass', 'Fail', 'Unknown'
    dot_status TEXT,
    operating_status TEXT,
    safety_rating TEXT,
    eld_status TEXT,
    eld_provider TEXT,
    
    -- Calculated Health Score (0-100)
    health_score INTEGER DEFAULT 0,
    health_status TEXT, -- 'Excellent', 'Good', 'Fair', 'Poor', 'Critical'
    
    -- Metadata
    last_updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by TEXT, -- Admin user ID
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(mc_number)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_carrier_health_data_mc_number ON carrier_health_data(mc_number);
CREATE INDEX IF NOT EXISTS idx_carrier_health_data_health_score ON carrier_health_data(health_score);
CREATE INDEX IF NOT EXISTS idx_carrier_health_data_last_updated ON carrier_health_data(last_updated_at);

-- Health Thresholds Table
-- Stores configurable thresholds for health score calculation
CREATE TABLE IF NOT EXISTS carrier_health_thresholds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_name TEXT NOT NULL UNIQUE, -- e.g., 'bluewire_score', 'connection_status', 'assessment_status'
    metric_type TEXT NOT NULL, -- 'numeric', 'boolean', 'enum', 'text'
    
    -- Threshold values (JSONB for flexibility)
    thresholds JSONB NOT NULL, -- e.g., {"excellent": 90, "good": 70, "fair": 50, "poor": 30}
    
    -- Weight for health score calculation (0-100)
    weight INTEGER DEFAULT 10,
    
    -- Rules/conditions (JSONB)
    rules JSONB,
    
    -- Metadata
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Default thresholds
INSERT INTO carrier_health_thresholds (metric_name, metric_type, thresholds, weight, description, is_active) VALUES
('bluewire_score', 'numeric', '{"excellent": 90, "good": 70, "fair": 50, "poor": 30}', 30, 'Bluewire overall score', true),
('connection_status', 'enum', '{"connected": 100, "not_connected": 0, "unknown": 50}', 20, 'ELD connection status', true),
('assessment_status', 'enum', '{"pass": 100, "partial_pass": 60, "fail": 0, "unknown": 50}', 25, 'Highway assessment status', true),
('dot_status', 'enum', '{"active": 100, "inactive": 0, "unknown": 50}', 10, 'DOT operating status', true),
('safety_rating', 'enum', '{"satisfactory": 100, "conditional": 50, "unsatisfactory": 0, "unrated": 75, "unknown": 50}', 15, 'FMCSA safety rating', true)
ON CONFLICT (metric_name) DO NOTHING;

COMMENT ON TABLE carrier_health_data IS 'Stores parsed Highway.com carrier health information and calculated health scores';
COMMENT ON TABLE carrier_health_thresholds IS 'Configurable thresholds for calculating carrier health scores';
COMMENT ON COLUMN carrier_health_data.health_score IS 'Calculated health score (0-100) based on thresholds';
COMMENT ON COLUMN carrier_health_data.health_status IS 'Human-readable health status based on score ranges';

