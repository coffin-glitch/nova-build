-- Migration: Create carrier_profiles table
-- Description: Stores carrier company information and credentials

CREATE TABLE IF NOT EXISTS carrier_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL UNIQUE,
    company_name TEXT NOT NULL,
    mc_number TEXT NOT NULL,
    dot_number TEXT,
    contact_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT,
    city TEXT,
    state TEXT,
    zip_code TEXT,
    fleet_size INTEGER DEFAULT 1,
    equipment_types TEXT DEFAULT '[]', -- JSON array
    insurance_provider TEXT,
    insurance_expiry TEXT,
    years_in_business INTEGER DEFAULT 0,
    specialties TEXT,
    notes TEXT,
    is_verified INTEGER DEFAULT 0, -- 0 = false, 1 = true
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create carrier_bids table to track carrier bids
CREATE TABLE IF NOT EXISTS carrier_bids (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    carrier_id TEXT NOT NULL,
    bid_id INTEGER NOT NULL,
    bid_amount DECIMAL(10,2) NOT NULL,
    bid_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'active', -- active, won, lost, expired
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bid_id) REFERENCES bids(id),
    UNIQUE(carrier_id, bid_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_carrier_profiles_user_id ON carrier_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_carrier_profiles_mc_number ON carrier_profiles(mc_number);
CREATE INDEX IF NOT EXISTS idx_carrier_profiles_dot_number ON carrier_profiles(dot_number);
CREATE INDEX IF NOT EXISTS idx_carrier_profiles_is_verified ON carrier_profiles(is_verified);

-- Create indexes for carrier_bids
CREATE INDEX IF NOT EXISTS idx_carrier_bids_carrier_id ON carrier_bids(carrier_id);
CREATE INDEX IF NOT EXISTS idx_carrier_bids_bid_id ON carrier_bids(bid_id);
CREATE INDEX IF NOT EXISTS idx_carrier_bids_status ON carrier_bids(status);
