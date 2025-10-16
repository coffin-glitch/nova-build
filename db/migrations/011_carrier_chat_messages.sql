-- PostgreSQL Migration: Create carrier_chat_messages table
-- Description: Stores messages from carriers via the floating Nova chat

CREATE TABLE IF NOT EXISTS carrier_chat_messages (
    id SERIAL PRIMARY KEY,
    carrier_user_id TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_carrier_chat_messages_carrier_user_id ON carrier_chat_messages(carrier_user_id);
CREATE INDEX IF NOT EXISTS idx_carrier_chat_messages_created_at ON carrier_chat_messages(created_at);
