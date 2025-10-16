-- PostgreSQL Migration: Create carrier_profiles and carrier_bids tables
-- Description: Stores carrier company information and tracks carrier bids

-- Create carrier_profiles table
CREATE TABLE IF NOT EXISTS carrier_profiles (
    id SERIAL PRIMARY KEY,
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
    equipment_types JSONB DEFAULT '[]',
    insurance_provider TEXT,
    insurance_expiry DATE,
    years_in_business INTEGER DEFAULT 0,
    specialties TEXT,
    notes TEXT,
    is_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create carrier_bids table to track carrier bids (matching upsertCarrierBid schema)
CREATE TABLE IF NOT EXISTS carrier_bids (
    id SERIAL PRIMARY KEY,
    bid_number TEXT NOT NULL,
    clerk_user_id TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(bid_number, clerk_user_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_carrier_profiles_user_id ON carrier_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_carrier_profiles_mc_number ON carrier_profiles(mc_number);
CREATE INDEX IF NOT EXISTS idx_carrier_profiles_dot_number ON carrier_profiles(dot_number);
CREATE INDEX IF NOT EXISTS idx_carrier_profiles_is_verified ON carrier_profiles(is_verified);

-- Create indexes for carrier_bids
CREATE INDEX IF NOT EXISTS idx_carrier_bids_clerk_user_id ON carrier_bids(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_carrier_bids_bid_number ON carrier_bids(bid_number);

-- Create bids table if it doesn't exist (for reference)
CREATE TABLE IF NOT EXISTS bids (
    id SERIAL PRIMARY KEY,
    bid_number TEXT NOT NULL UNIQUE,
    origin TEXT,
    destination TEXT,
    distance INTEGER,
    rate DECIMAL(10,2),
    status TEXT DEFAULT 'active',
    pickup_date TIMESTAMP,
    equipment TEXT,
    weight INTEGER,
    current_bid DECIMAL(10,2),
    bid_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP
);
