-- Migration: Create proper messaging system with conversation-based read tracking
-- Description: Implements industry-standard messaging schema with proper read receipts

-- Create conversations table to group messages between users
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    carrier_user_id TEXT NOT NULL,
    admin_user_id TEXT NOT NULL,
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(carrier_user_id, admin_user_id)
);

-- Create messages table for all messages in conversations
CREATE TABLE IF NOT EXISTS conversation_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id TEXT NOT NULL,
    sender_type TEXT NOT NULL CHECK (sender_type IN ('admin', 'carrier')),
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create message_reads table to track read status per user per message
CREATE TABLE IF NOT EXISTS message_reads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES conversation_messages(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    read_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(message_id, user_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_conversations_carrier_user_id ON conversations(carrier_user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_admin_user_id ON conversations(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at ON conversations(last_message_at);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_conversation_id ON conversation_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_sender_id ON conversation_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_created_at ON conversation_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_message_reads_message_id ON message_reads(message_id);
CREATE INDEX IF NOT EXISTS idx_message_reads_user_id ON message_reads(user_id);

-- Create trigger to update conversation last_message_at
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE conversations 
    SET last_message_at = NEW.created_at, updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_conversation_last_message
    AFTER INSERT ON conversation_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_last_message();

-- Create trigger to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_conversation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_conversation_updated_at
    BEFORE UPDATE ON conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_updated_at();

CREATE TRIGGER trigger_update_conversation_message_updated_at
    BEFORE UPDATE ON conversation_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_updated_at();
