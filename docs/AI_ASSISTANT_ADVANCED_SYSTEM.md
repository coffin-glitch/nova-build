# Advanced AI Assistant System - RAG with Memory Recall

## Overview

This is a comprehensive RAG (Retrieval Augmented Generation) system that provides:
- **Personal Conversation History**: Each admin has their own separate chat history
- **Memory Recall**: AI can recall information from previous conversations using semantic search
- **Shared Knowledge Base**: All admins benefit from insights extracted from conversations
- **Conversation Organization**: Folders and tags for organizing conversations
- **Vector Search**: Uses pgvector for fast semantic similarity search

## Architecture

### Database Schema

1. **ai_assistant_conversations**: Personal conversations per admin
2. **ai_assistant_messages**: Messages with vector embeddings
3. **ai_assistant_folders**: Organization folders
4. **ai_memory_chunks**: Personal memory chunks for each admin
5. **ai_knowledge_base**: Shared knowledge accessible to all admins

### Key Features

#### 1. Vector Embeddings
- All messages are embedded using OpenAI `text-embedding-ada-002` (1536 dimensions)
- Stored in PostgreSQL using pgvector extension
- Enables semantic search across conversations

#### 2. Memory Recall System
- When you ask a question, the system:
  1. Generates embedding for your query
  2. Searches personal memories (your past conversations)
  3. Searches shared knowledge base (all admins' insights)
  4. Injects relevant context into AI prompt
  5. AI responds with context from past conversations

#### 3. Knowledge Extraction
- After conversations, system can extract:
  - Key insights and facts
  - Patterns and trends
  - Important preferences
  - Categories automatically

#### 4. Conversation Management
- **New Chat**: Start fresh conversations
- **Conversation List**: View and switch between conversations
- **Folders**: Organize conversations (coming soon)
- **Search**: Find conversations by content (coming soon)

## Setup

### 1. Run Database Migrations

```bash
# Run the advanced memory system migration
psql $DATABASE_URL -f db/migrations/112_ai_assistant_advanced_memory.sql
```

**Note**: This requires the `pgvector` extension. If it's not available, you may need to enable it in Supabase:
- Go to Supabase Dashboard → Database → Extensions
- Enable "vector" extension

### 2. Environment Variables

Make sure you have:
```bash
OPENAI_API_KEY=sk-proj-...
```

### 3. Features

#### New Chat Button
- Click the "+" button in the header to start a new conversation
- Previous conversations are preserved

#### Conversation List
- Click the message icon to view all conversations
- Click any conversation to load it
- Conversations are sorted by most recent

#### Memory Recall
- Happens automatically when you ask questions
- AI will recall relevant information from past conversations
- Works across all your conversations

#### Knowledge Base
- Insights are automatically extracted from conversations
- Stored in shared knowledge base
- All admins can benefit from these insights

## API Endpoints

### Main Chat
- `POST /api/admin/ai-assistant` - Send message (with memory recall)
- `GET /api/admin/ai-assistant` - Get conversations
- `GET /api/admin/ai-assistant?conversation_id=xxx` - Get specific conversation

### Memory System
- `GET /api/admin/ai-assistant/memory?query=...` - Search memories
- `POST /api/admin/ai-assistant/knowledge` - Extract knowledge from conversation

## How Memory Recall Works

1. **User asks question**: "What was our win rate last month?"
2. **System generates embedding** for the question
3. **Searches personal memories** for similar past conversations
4. **Searches shared knowledge** for relevant insights
5. **Injects context** into AI prompt:
   ```
   Relevant context from previous conversations:
   Personal insights:
   - Win rate was 45% in November
   - Best performing routes are Chicago to New York
   
   Shared knowledge:
   - Average win rate across all admins: 42%
   ```
6. **AI responds** with context-aware answer

## Knowledge Base Extraction

After a conversation, you can extract knowledge:

```typescript
POST /api/admin/ai-assistant/knowledge
{
  "conversationId": "uuid"
}
```

This will:
1. Analyze the conversation
2. Extract key insights
3. Generate embeddings
4. Store in knowledge base (shared)
5. Store in memory chunks (personal)

## Best Practices

### For Admins
- **Ask specific questions**: Better for memory recall
- **Reference past conversations**: "Remember when we discussed..."
- **Use consistent terminology**: Helps with semantic search

### For System
- **Automatic extraction**: Knowledge is extracted automatically
- **Relevance scoring**: Only high-relevance insights are stored
- **Access tracking**: Popular knowledge is prioritized

## Cost Considerations

- **Embeddings**: ~$0.0001 per 1K tokens (very cheap)
- **Memory recall**: Only searches when needed
- **Knowledge extraction**: Optional, can be triggered manually

## Future Enhancements

1. **Conversation Folders**: Organize by topic/project
2. **Search**: Full-text search across conversations
3. **Export**: Export conversations to CSV/JSON
4. **Analytics**: Track most useful memories
5. **Auto-categorization**: Automatically categorize conversations
6. **Smart Summaries**: Auto-generate conversation summaries

## Troubleshooting

### "pgvector extension not found"
- Enable it in Supabase Dashboard → Database → Extensions
- Or run: `CREATE EXTENSION IF NOT EXISTS vector;`

### "Embedding generation failed"
- Check OPENAI_API_KEY is set
- Check you have API credits
- Embeddings are optional - system works without them (no memory recall)

### "Memory recall not working"
- Check embeddings are being generated (check database)
- Verify similarity threshold (default 0.7)
- Check vector indexes are created

## Technical Details

### Vector Search
- Uses cosine similarity (`<=>` operator)
- HNSW index for fast approximate search
- Similarity threshold: 0.7 (70% similarity)

### Embedding Model
- Model: `text-embedding-ada-002`
- Dimensions: 1536
- Cost: ~$0.0001 per 1K tokens

### Performance
- Vector search: < 50ms for 10K memories
- Embedding generation: ~200ms per message
- Knowledge extraction: ~2-3 seconds per conversation

