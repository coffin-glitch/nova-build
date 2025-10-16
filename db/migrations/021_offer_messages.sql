-- Migration: Add Offer Messages System
-- Description: Creates tables for offer-specific messaging between admins and carriers

-- Offer messages table
CREATE TABLE IF NOT EXISTS offer_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    offer_id UUID NOT NULL REFERENCES load_offers(id) ON DELETE CASCADE,
    sender_id TEXT NOT NULL,
    sender_role TEXT NOT NULL CHECK (sender_role IN ('admin', 'carrier')),
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_offer_messages_offer_id ON offer_messages(offer_id);
CREATE INDEX IF NOT EXISTS idx_offer_messages_sender_id ON offer_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_offer_messages_created_at ON offer_messages(created_at);

-- Add message count to load_offers table for quick access
ALTER TABLE load_offers ADD COLUMN IF NOT EXISTS message_count INTEGER DEFAULT 0;
ALTER TABLE load_offers ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMP WITH TIME ZONE;

-- Create trigger to update message count
CREATE OR REPLACE FUNCTION update_offer_message_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE load_offers 
        SET 
            message_count = message_count + 1,
            last_message_at = NEW.created_at
        WHERE id = NEW.offer_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE load_offers 
        SET message_count = GREATEST(message_count - 1, 0)
        WHERE id = OLD.offer_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_offer_message_count ON offer_messages;
CREATE TRIGGER trigger_update_offer_message_count
    AFTER INSERT OR DELETE ON offer_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_offer_message_count();
