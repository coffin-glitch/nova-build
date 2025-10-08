-- Create load_offers table for carrier offers on published loads
CREATE TABLE IF NOT EXISTS load_offers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  load_rr_number TEXT NOT NULL,
  carrier_user_id TEXT NOT NULL,
  offer_amount INTEGER NOT NULL, -- Amount in cents
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, accepted, rejected, countered
  counter_amount INTEGER, -- Counter offer amount in cents
  admin_notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (load_rr_number) REFERENCES loads(rr_number),
  FOREIGN KEY (carrier_user_id) REFERENCES user_roles_cache(clerk_user_id)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_load_offers_load_rr ON load_offers(load_rr_number);
CREATE INDEX IF NOT EXISTS idx_load_offers_carrier ON load_offers(carrier_user_id);
CREATE INDEX IF NOT EXISTS idx_load_offers_status ON load_offers(status);