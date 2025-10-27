-- Migration: Fix carrier_favorites table structure
-- Description: Update carrier_favorites table to use bid_number instead of load_id

-- Step 1: Drop the existing table if it has the wrong structure
DROP TABLE IF EXISTS carrier_favorites CASCADE;

-- Step 2: Recreate the table with correct structure
CREATE TABLE carrier_favorites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    carrier_user_id TEXT NOT NULL,
    bid_number TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(carrier_user_id, bid_number)
);

-- Step 3: Create indexes for better performance
CREATE INDEX idx_carrier_favorites_carrier_user_id ON carrier_favorites(carrier_user_id);
CREATE INDEX idx_carrier_favorites_bid_number ON carrier_favorites(bid_number);

COMMENT ON TABLE carrier_favorites IS 'Stores favorited bids for carriers';

