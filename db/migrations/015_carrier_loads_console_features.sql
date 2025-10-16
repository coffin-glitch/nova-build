-- Migration for carrier loads console features
-- This migration adds tables for load lifecycle events and notifications

-- Load lifecycle events table
CREATE TABLE IF NOT EXISTS load_lifecycle_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    load_offer_id UUID NOT NULL REFERENCES load_offers(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    location VARCHAR(255),
    photos TEXT[], -- Array of photo URLs
    documents TEXT[], -- Array of document URLs
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Carrier notifications table
CREATE TABLE IF NOT EXISTS carrier_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    carrier_user_id VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'status_change', 'offer_response', 'load_update', 'system'
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high'
    read BOOLEAN NOT NULL DEFAULT FALSE,
    load_id UUID REFERENCES load_offers(id) ON DELETE CASCADE,
    action_url VARCHAR(500), -- URL to navigate to when notification is clicked
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Notification settings table
CREATE TABLE IF NOT EXISTS carrier_notification_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    carrier_user_id VARCHAR(255) NOT NULL UNIQUE,
    email_notifications BOOLEAN NOT NULL DEFAULT TRUE,
    push_notifications BOOLEAN NOT NULL DEFAULT TRUE,
    status_change_notifications BOOLEAN NOT NULL DEFAULT TRUE,
    offer_response_notifications BOOLEAN NOT NULL DEFAULT TRUE,
    load_update_notifications BOOLEAN NOT NULL DEFAULT TRUE,
    system_notifications BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_load_lifecycle_events_load_offer_id ON load_lifecycle_events(load_offer_id);
CREATE INDEX IF NOT EXISTS idx_load_lifecycle_events_timestamp ON load_lifecycle_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_carrier_notifications_user_id ON carrier_notifications(carrier_user_id);
CREATE INDEX IF NOT EXISTS idx_carrier_notifications_read ON carrier_notifications(read);
CREATE INDEX IF NOT EXISTS idx_carrier_notifications_timestamp ON carrier_notifications(timestamp);
CREATE INDEX IF NOT EXISTS idx_carrier_notification_settings_user_id ON carrier_notification_settings(carrier_user_id);

-- Add triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
DROP TRIGGER IF EXISTS update_load_lifecycle_events_updated_at ON load_lifecycle_events;
CREATE TRIGGER update_load_lifecycle_events_updated_at
    BEFORE UPDATE ON load_lifecycle_events
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_carrier_notifications_updated_at ON carrier_notifications;
CREATE TRIGGER update_carrier_notifications_updated_at
    BEFORE UPDATE ON carrier_notifications
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_carrier_notification_settings_updated_at ON carrier_notification_settings;
CREATE TRIGGER update_carrier_notification_settings_updated_at
    BEFORE UPDATE ON carrier_notification_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
