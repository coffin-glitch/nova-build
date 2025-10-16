-- Migration: Add is_read and read_at columns to carrier_chat_messages table
-- Description: Enables read/unread tracking for carrier chat messages

-- Add is_read and read_at columns to carrier_chat_messages table
ALTER TABLE carrier_chat_messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;
ALTER TABLE carrier_chat_messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE;

-- Create index for better performance on read status
CREATE INDEX IF NOT EXISTS idx_carrier_chat_messages_is_read ON carrier_chat_messages(is_read);
CREATE INDEX IF NOT EXISTS idx_carrier_chat_messages_read_at ON carrier_chat_messages(read_at);
