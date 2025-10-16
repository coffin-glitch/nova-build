-- Migration: Migrate existing messaging data to new conversation-based schema
-- Description: Transfers data from old admin_messages/carrier_responses to new schema

-- Migrate admin_messages to conversations and conversation_messages
INSERT INTO conversations (carrier_user_id, admin_user_id, last_message_at, created_at, updated_at)
SELECT DISTINCT 
    carrier_user_id, 
    admin_user_id, 
    MAX(created_at) as last_message_at,
    MIN(created_at) as created_at,
    MAX(updated_at) as updated_at
FROM admin_messages 
GROUP BY carrier_user_id, admin_user_id
ON CONFLICT (carrier_user_id, admin_user_id) DO NOTHING;

-- Migrate admin messages to conversation_messages
INSERT INTO conversation_messages (conversation_id, sender_id, sender_type, message, created_at, updated_at)
SELECT 
    c.id as conversation_id,
    am.admin_user_id as sender_id,
    'admin' as sender_type,
    am.message,
    am.created_at,
    am.updated_at
FROM admin_messages am
JOIN conversations c ON c.carrier_user_id = am.carrier_user_id AND c.admin_user_id = am.admin_user_id;

-- Migrate carrier responses to conversation_messages
INSERT INTO conversation_messages (conversation_id, sender_id, sender_type, message, created_at, updated_at)
SELECT 
    c.id as conversation_id,
    cr.carrier_user_id as sender_id,
    'carrier' as sender_type,
    cr.response as message,
    cr.created_at,
    cr.updated_at
FROM carrier_responses cr
JOIN admin_messages am ON am.id = cr.message_id
JOIN conversations c ON c.carrier_user_id = am.carrier_user_id AND c.admin_user_id = am.admin_user_id;

-- Create read receipts for admin messages that were marked as read
INSERT INTO message_reads (message_id, user_id, read_at)
SELECT 
    cm.id as message_id,
    cm.conversation_id::text as user_id, -- This will be updated with proper user_id
    am.read_at
FROM conversation_messages cm
JOIN admin_messages am ON am.message = cm.message AND am.created_at = cm.created_at
WHERE am.is_read = true AND cm.sender_type = 'admin';

-- Update the read receipts with proper carrier_user_id
UPDATE message_reads 
SET user_id = (
    SELECT c.carrier_user_id 
    FROM conversations c 
    JOIN conversation_messages cm ON cm.conversation_id = c.id 
    WHERE cm.id = message_reads.message_id
)
WHERE user_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
