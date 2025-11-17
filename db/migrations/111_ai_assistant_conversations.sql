-- Migration 111: Create AI Assistant Conversations Table
-- Description: Stores AI assistant conversation history for admins

-- Create ai_assistant_conversations table
CREATE TABLE IF NOT EXISTS ai_assistant_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_user_id TEXT NOT NULL,
    title TEXT, -- Optional: First message or user-defined title
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create ai_assistant_messages table
CREATE TABLE IF NOT EXISTS ai_assistant_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES ai_assistant_conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    metadata JSONB, -- Store any additional metadata (usage stats, function calls, etc.)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_ai_assistant_conversations_admin_user_id 
    ON ai_assistant_conversations(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_ai_assistant_conversations_updated_at 
    ON ai_assistant_conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_assistant_messages_conversation_id 
    ON ai_assistant_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_assistant_messages_created_at 
    ON ai_assistant_messages(created_at);

-- Add comments for documentation
COMMENT ON TABLE ai_assistant_conversations IS 'AI assistant conversation sessions for admins';
COMMENT ON TABLE ai_assistant_messages IS 'Individual messages in AI assistant conversations';
COMMENT ON COLUMN ai_assistant_messages.metadata IS 'Additional metadata like token usage, function calls, etc.';

-- Create trigger to update updated_at on conversation
CREATE OR REPLACE FUNCTION update_ai_assistant_conversation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE ai_assistant_conversations
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_ai_assistant_conversation_updated_at ON ai_assistant_messages;
CREATE TRIGGER trigger_update_ai_assistant_conversation_updated_at
    AFTER INSERT ON ai_assistant_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_ai_assistant_conversation_updated_at();

