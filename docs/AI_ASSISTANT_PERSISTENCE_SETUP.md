# AI Assistant Persistence Setup

## Overview

The AI assistant now saves all conversations to the Supabase database, so your chat history persists across sessions!

## Database Migration

Run the migration to create the necessary tables:

```bash
# Using psql
psql $DATABASE_URL -f db/migrations/111_ai_assistant_conversations.sql

# Or using Supabase SQL Editor
# Copy and paste the contents of db/migrations/111_ai_assistant_conversations.sql
```

## Features

✅ **Persistent Conversations**: All messages are saved to the database
✅ **Conversation History**: Previous conversations are automatically loaded
✅ **Per-Admin Storage**: Each admin has their own conversation history
✅ **Metadata Tracking**: Token usage and function calls are stored

## How It Works

1. **First Message**: Creates a new conversation automatically
2. **Subsequent Messages**: Continues the same conversation
3. **Page Refresh**: Conversation history is automatically loaded
4. **New Conversation**: Starts fresh when you close and reopen (or implement conversation switching)

## Database Schema

### `ai_assistant_conversations`
- Stores conversation sessions
- Links to admin user
- Tracks title and timestamps

### `ai_assistant_messages`
- Stores individual messages
- Links to conversation
- Stores role (user/assistant), content, and metadata

## API Endpoints

### GET `/api/admin/ai-assistant`
- Get all conversations: `GET /api/admin/ai-assistant`
- Get specific conversation: `GET /api/admin/ai-assistant?conversation_id=xxx`

### POST `/api/admin/ai-assistant`
- Send message: `POST /api/admin/ai-assistant`
- Body: `{ message: "...", conversationId: "..." }`

## Next Steps (Optional Enhancements)

1. **Conversation List**: Show list of previous conversations
2. **Conversation Switching**: Allow switching between conversations
3. **Delete Conversations**: Add ability to delete old conversations
4. **Search**: Search through conversation history
5. **Export**: Export conversations to CSV/JSON

