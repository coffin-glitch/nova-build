-- Add is_internal column if it doesn't exist
ALTER TABLE bid_messages 
ADD COLUMN IF NOT EXISTS is_internal BOOLEAN DEFAULT false;

-- Create index if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_bid_messages_is_internal ON bid_messages(is_internal);
