-- Migration: Add shop status setting
-- Description: Creates a simple key-value table for system settings like shop status

CREATE TABLE IF NOT EXISTS system_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    setting_key TEXT NOT NULL UNIQUE,
    setting_value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(setting_key);

-- Insert default shop status (shop is open by default)
INSERT INTO system_settings (setting_key, setting_value, description)
VALUES ('shop_status', 'open', 'Shop status: open or closed')
ON CONFLICT (setting_key) DO NOTHING;

