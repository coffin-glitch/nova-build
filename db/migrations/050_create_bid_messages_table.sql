-- Migration 050: Create bid_messages table
-- Description: Creates bid-specific messaging between carriers and admins
-- This allows carriers and admins to communicate about specific awarded bids

CREATE TABLE IF NOT EXISTS bid_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bid_number TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    sender_role TEXT NOT NULL CHECK (sender_role IN ('admin', 'carrier')),
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_bid_messages_bid_number ON bid_messages(bid_number);
CREATE INDEX IF NOT EXISTS idx_bid_messages_sender_id ON bid_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_bid_messages_created_at ON bid_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_bid_messages_read_at ON bid_messages(read_at);
CREATE INDEX IF NOT EXISTS idx_bid_messages_sender_role ON bid_messages(sender_role);

-- Add comments for documentation
COMMENT ON TABLE bid_messages IS 'Messages between carriers and admins about specific bids';
COMMENT ON COLUMN bid_messages.bid_number IS 'The bid number this message relates to';
COMMENT ON COLUMN bid_messages.sender_id IS 'Clerk user ID of the sender';
COMMENT ON COLUMN bid_messages.sender_role IS 'Role of sender: admin or carrier';
COMMENT ON COLUMN bid_messages.message IS 'Message content';
COMMENT ON COLUMN bid_messages.read_at IS 'When the message was read by the recipient';
COMMENT ON COLUMN bid_messages.created_at IS 'When the message was sent';

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_bid_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_bid_messages_updated_at ON bid_messages;
CREATE TRIGGER trigger_update_bid_messages_updated_at
    BEFORE UPDATE ON bid_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_bid_messages_updated_at();

