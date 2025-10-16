-- Migration: Add Enhanced EAX Fields to Loads Table
-- Description: Adds all missing EAX CSV columns to support complete EAX upload functionality

-- Add new EAX-specific columns to loads table
ALTER TABLE loads ADD COLUMN IF NOT EXISTS load_number TEXT;
ALTER TABLE loads ADD COLUMN IF NOT EXISTS target_buy DECIMAL;
ALTER TABLE loads ADD COLUMN IF NOT EXISTS max_buy DECIMAL;
ALTER TABLE loads ADD COLUMN IF NOT EXISTS spot_bid TEXT;
ALTER TABLE loads ADD COLUMN IF NOT EXISTS fuel_surcharge DECIMAL DEFAULT 0;
ALTER TABLE loads ADD COLUMN IF NOT EXISTS docs_scanned TEXT;
ALTER TABLE loads ADD COLUMN IF NOT EXISTS invoice_date DATE;
ALTER TABLE loads ADD COLUMN IF NOT EXISTS invoice_audit TEXT;
ALTER TABLE loads ADD COLUMN IF NOT EXISTS purch_tr DECIMAL;
ALTER TABLE loads ADD COLUMN IF NOT EXISTS net_mrg DECIMAL;
ALTER TABLE loads ADD COLUMN IF NOT EXISTS cm DECIMAL;
ALTER TABLE loads ADD COLUMN IF NOT EXISTS nbr_of_stops INTEGER;
ALTER TABLE loads ADD COLUMN IF NOT EXISTS vendor_dispatch TEXT;

-- Add indexes for better performance on new fields
CREATE INDEX IF NOT EXISTS idx_loads_load_number ON loads(load_number);
CREATE INDEX IF NOT EXISTS idx_loads_target_buy ON loads(target_buy);
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

-- Add new EAX-specific columns to loads table
ALTER TABLE loads ADD COLUMN IF NOT EXISTS load_number TEXT;
ALTER TABLE loads ADD COLUMN IF NOT EXISTS target_buy DECIMAL;
ALTER TABLE loads ADD COLUMN IF NOT EXISTS max_buy DECIMAL;
ALTER TABLE loads ADD COLUMN IF NOT EXISTS spot_bid TEXT;
ALTER TABLE loads ADD COLUMN IF NOT EXISTS fuel_surcharge DECIMAL DEFAULT 0;
ALTER TABLE loads ADD COLUMN IF NOT EXISTS docs_scanned TEXT;
ALTER TABLE loads ADD COLUMN IF NOT EXISTS invoice_date DATE;
ALTER TABLE loads ADD COLUMN IF NOT EXISTS invoice_audit TEXT;
ALTER TABLE loads ADD COLUMN IF NOT EXISTS purch_tr DECIMAL;
ALTER TABLE loads ADD COLUMN IF NOT EXISTS net_mrg DECIMAL;
ALTER TABLE loads ADD COLUMN IF NOT EXISTS cm DECIMAL;
ALTER TABLE loads ADD COLUMN IF NOT EXISTS nbr_of_stops INTEGER;
ALTER TABLE loads ADD COLUMN IF NOT EXISTS vendor_dispatch TEXT;

-- Add indexes for better performance on new fields
CREATE INDEX IF NOT EXISTS idx_loads_load_number ON loads(load_number);
CREATE INDEX IF NOT EXISTS idx_loads_target_buy ON loads(target_buy);
CREATE INDEX IF NOT EXISTS idx_loads_max_buy ON loads(max_buy);
CREATE INDEX IF NOT EXISTS idx_loads_customer_name ON loads(customer_name);
CREATE INDEX IF NOT EXISTS idx_loads_vendor_dispatch ON loads(vendor_dispatch);
