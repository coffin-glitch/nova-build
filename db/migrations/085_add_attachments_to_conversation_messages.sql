-- Migration: Add attachment support to conversation_messages
-- Description: Allows carriers and admins to send photos and documents through chat

-- Add attachment fields to conversation_messages table
ALTER TABLE conversation_messages 
ADD COLUMN IF NOT EXISTS attachment_url TEXT,
ADD COLUMN IF NOT EXISTS attachment_type TEXT,
ADD COLUMN IF NOT EXISTS attachment_name TEXT,
ADD COLUMN IF NOT EXISTS attachment_size INTEGER;

-- Create index for attachment queries
CREATE INDEX IF NOT EXISTS idx_conversation_messages_attachment_url 
ON conversation_messages(attachment_url) 
WHERE attachment_url IS NOT NULL;

-- Add comments
COMMENT ON COLUMN conversation_messages.attachment_url IS 'URL to the attached file (Supabase Storage or similar)';
COMMENT ON COLUMN conversation_messages.attachment_type IS 'MIME type of the attachment (e.g., image/jpeg, application/pdf)';
COMMENT ON COLUMN conversation_messages.attachment_name IS 'Original filename of the attachment';
COMMENT ON COLUMN conversation_messages.attachment_size IS 'Size of the attachment in bytes';

