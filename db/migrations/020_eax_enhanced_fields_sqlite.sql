-- Migration: Add Enhanced EAX Fields to Loads Table (SQLite)
-- Description: Adds all missing EAX CSV columns to support complete EAX upload functionality

-- Add new EAX-specific columns to loads table
ALTER TABLE loads ADD COLUMN load_number TEXT;
ALTER TABLE loads ADD COLUMN target_buy REAL;
ALTER TABLE loads ADD COLUMN max_buy REAL;
ALTER TABLE loads ADD COLUMN spot_bid TEXT;
ALTER TABLE loads ADD COLUMN fuel_surcharge REAL DEFAULT 0;
ALTER TABLE loads ADD COLUMN docs_scanned TEXT;
ALTER TABLE loads ADD COLUMN invoice_date TEXT;
ALTER TABLE loads ADD COLUMN invoice_audit TEXT;
ALTER TABLE loads ADD COLUMN purch_tr REAL;
ALTER TABLE loads ADD COLUMN net_mrg REAL;
ALTER TABLE loads ADD COLUMN cm REAL;
ALTER TABLE loads ADD COLUMN nbr_of_stops INTEGER;
ALTER TABLE loads ADD COLUMN vendor_dispatch TEXT;

-- Add indexes for better performance on new fields
CREATE INDEX IF NOT EXISTS idx_loads_load_number ON loads(load_number);
CREATE INDEX IF NOT EXISTS idx_loads_target_buy ON loads(target_buy);
CREATE INDEX IF NOT EXISTS idx_loads_max_buy ON loads(max_buy);
CREATE INDEX IF NOT EXISTS idx_loads_customer_name ON loads(customer_name);
CREATE INDEX IF NOT EXISTS idx_loads_vendor_dispatch ON loads(vendor_dispatch);
