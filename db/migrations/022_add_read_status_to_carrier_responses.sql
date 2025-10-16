-- Migration: Add is_read and read_at columns to carrier_responses table
-- Description: Enables read/unread tracking for carrier responses

-- Add is_read and read_at columns to carrier_responses table
ALTER TABLE carrier_responses ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;
ALTER TABLE carrier_responses ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE;

-- Create index for better performance on read status
CREATE INDEX IF NOT EXISTS idx_carrier_responses_is_read ON carrier_responses(is_read);
CREATE INDEX IF NOT EXISTS idx_carrier_responses_read_at ON carrier_responses(read_at);
