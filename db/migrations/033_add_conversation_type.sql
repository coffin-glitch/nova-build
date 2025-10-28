-- Migration: Add conversation type to distinguish between regular chat and appeal conversations
-- Description: Separates floating chat conversations from appeal decision conversations

-- Add conversation_type column to conversations table
ALTER TABLE conversations 
ADD COLUMN conversation_type TEXT DEFAULT 'regular' 
CHECK (conversation_type IN ('regular', 'appeal'));

-- Add comment for clarity
COMMENT ON COLUMN conversations.conversation_type IS 'Type of conversation: regular (floating chat) or appeal (profile appeal decisions)';

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_conversations_type ON conversations(conversation_type);

-- Update existing conversations to be 'regular' type (floating chat)
UPDATE conversations SET conversation_type = 'regular' WHERE conversation_type IS NULL;
