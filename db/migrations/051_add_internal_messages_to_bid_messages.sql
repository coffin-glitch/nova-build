-- Migration 051: Add internal messaging to bid_messages table
-- Description: Adds is_internal flag to allow admin-only messages
-- Admin notes/comments that carriers shouldn't see

-- Add is_internal column
ALTER TABLE bid_messages 
ADD COLUMN IF NOT EXISTS is_internal BOOLEAN DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN bid_messages.is_internal IS 'If true, only admins can see this message (internal admin notes)';

-- Create index for filtering
CREATE INDEX IF NOT EXISTS idx_bid_messages_is_internal ON bid_messages(is_internal);

-- Update the query to filter internal messages for non-admin users
-- This will be done in the API route

