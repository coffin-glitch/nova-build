-- Migration: Add profile locking and messaging system
-- Description: Prevents carriers from modifying profiles after submission and adds admin messaging

-- Add profile locking fields to carrier_profiles
ALTER TABLE carrier_profiles ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false;
ALTER TABLE carrier_profiles ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP;
ALTER TABLE carrier_profiles ADD COLUMN IF NOT EXISTS locked_by TEXT; -- admin user_id who locked it
ALTER TABLE carrier_profiles ADD COLUMN IF NOT EXISTS lock_reason TEXT;

-- Create admin_messages table for admin-to-carrier communication
CREATE TABLE IF NOT EXISTS admin_messages (
    id SERIAL PRIMARY KEY,
    carrier_user_id TEXT NOT NULL,
    admin_user_id TEXT NOT NULL,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create carrier_responses table for carrier-to-admin responses
CREATE TABLE IF NOT EXISTS carrier_responses (
    id SERIAL PRIMARY KEY,
    message_id INTEGER NOT NULL REFERENCES admin_messages(id) ON DELETE CASCADE,
    carrier_user_id TEXT NOT NULL,
    response TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_carrier_profiles_is_locked ON carrier_profiles(is_locked);
CREATE INDEX IF NOT EXISTS idx_admin_messages_carrier_user_id ON admin_messages(carrier_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_messages_admin_user_id ON admin_messages(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_messages_is_read ON admin_messages(is_read);
CREATE INDEX IF NOT EXISTS idx_carrier_responses_message_id ON carrier_responses(message_id);
CREATE INDEX IF NOT EXISTS idx_carrier_responses_carrier_user_id ON carrier_responses(carrier_user_id);
