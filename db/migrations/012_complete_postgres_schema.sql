-- PostgreSQL Migration: Complete Database Schema Setup
-- Description: Creates all required tables for NOVA Build application

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- User roles table (legacy support)
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'carrier')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User roles cache table (centralized)
CREATE TABLE IF NOT EXISTS user_roles_cache (
    clerk_user_id TEXT PRIMARY KEY,
    role TEXT NOT NULL CHECK (role IN ('admin', 'carrier', 'none')),
    email TEXT NOT NULL,
    last_synced TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    clerk_updated_at BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Telegram bids table
CREATE TABLE IF NOT EXISTS telegram_bids (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bid_number TEXT NOT NULL UNIQUE,
    distance_miles DECIMAL,
    pickup_timestamp TIMESTAMP WITH TIME ZONE,
    delivery_timestamp TIMESTAMP WITH TIME ZONE,
    stops TEXT, -- JSON string
    tag TEXT,
    source_channel TEXT NOT NULL,
    forwarded_to TEXT,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE,
    published BOOLEAN DEFAULT true
);

-- Loads table
CREATE TABLE IF NOT EXISTS loads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rr_number TEXT NOT NULL UNIQUE,
    tm_number TEXT,
    status_code TEXT,
    origin_city TEXT,
    origin_state TEXT,
    destination_city TEXT,
    destination_state TEXT,
    equipment TEXT,
    weight DECIMAL,
    revenue DECIMAL,
    purchase DECIMAL,
    net DECIMAL,
    margin DECIMAL,
    customer_name TEXT,
    customer_ref TEXT,
    driver_name TEXT,
    vendor_name TEXT,
    dispatcher_name TEXT,
    pickup_date DATE,
    pickup_time TEXT,
    delivery_date DATE,
    delivery_time TEXT,
    stops INTEGER,
    miles INTEGER,
    published BOOLEAN DEFAULT false,
    archived BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Telegram bid offers table
CREATE TABLE IF NOT EXISTS telegram_bid_offers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bid_id UUID NOT NULL,
    user_id TEXT NOT NULL,
    amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bid_id) REFERENCES telegram_bids(id) ON DELETE CASCADE
);

-- Load offers table
CREATE TABLE IF NOT EXISTS load_offers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    load_rr_number TEXT NOT NULL,
    carrier_user_id TEXT NOT NULL,
    offer_amount INTEGER NOT NULL CHECK (offer_amount >= 0),
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'countered')),
    counter_amount INTEGER,
    admin_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (load_rr_number) REFERENCES loads(rr_number) ON DELETE CASCADE
);

-- Assignments table
CREATE TABLE IF NOT EXISTS assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rr_number TEXT NOT NULL,
    user_id TEXT NOT NULL,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status TEXT NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'picked_up', 'delivered', 'cancelled')),
    FOREIGN KEY (rr_number) REFERENCES loads(rr_number) ON DELETE CASCADE
);

-- Carrier profiles table
CREATE TABLE IF NOT EXISTS carrier_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clerk_user_id TEXT NOT NULL UNIQUE,
    mc_number TEXT,
    dot_number TEXT,
    phone TEXT,
    dispatch_email TEXT,
    company_name TEXT,
    contact_name TEXT,
    is_locked BOOLEAN DEFAULT false,
    locked_at TIMESTAMP WITH TIME ZONE,
    locked_by TEXT,
    lock_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Carrier bids table
CREATE TABLE IF NOT EXISTS carrier_bids (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bid_number TEXT NOT NULL,
    clerk_user_id TEXT NOT NULL,
    amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(bid_number, clerk_user_id)
);

-- Carrier chat messages table
CREATE TABLE IF NOT EXISTS carrier_chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    carrier_user_id TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Admin messages table
CREATE TABLE IF NOT EXISTS admin_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    carrier_user_id TEXT NOT NULL,
    admin_user_id TEXT NOT NULL,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Dedicated lanes table
CREATE TABLE IF NOT EXISTS dedicated_lanes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    rate TEXT,
    primary_lanes TEXT,
    contract_length TEXT,
    client TEXT,
    requirements TEXT, -- JSON string
    benefits TEXT, -- JSON string
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'upcoming', 'completed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_carrier_profiles_clerk_user_id ON carrier_profiles(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_carrier_profiles_is_locked ON carrier_profiles(is_locked);
CREATE INDEX IF NOT EXISTS idx_carrier_chat_messages_carrier_user_id ON carrier_chat_messages(carrier_user_id);
CREATE INDEX IF NOT EXISTS idx_carrier_bids_clerk_user_id ON carrier_bids(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_carrier_bids_bid_number ON carrier_bids(bid_number);
CREATE INDEX IF NOT EXISTS idx_admin_messages_carrier_user_id ON admin_messages(carrier_user_id);
CREATE INDEX IF NOT EXISTS idx_load_offers_carrier_user_id ON load_offers(carrier_user_id);
CREATE INDEX IF NOT EXISTS idx_load_offers_load_rr_number ON load_offers(load_rr_number);
CREATE INDEX IF NOT EXISTS idx_telegram_bids_bid_number ON telegram_bids(bid_number);
CREATE INDEX IF NOT EXISTS idx_loads_rr_number ON loads(rr_number);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_cache_clerk_user_id ON user_roles_cache(clerk_user_id);
