-- Migration 112: Advanced AI Assistant Memory System
-- Description: Implements RAG (Retrieval Augmented Generation) with vector search, folders, and shared knowledge base

-- Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Add folder/organization to conversations
ALTER TABLE ai_assistant_conversations 
ADD COLUMN IF NOT EXISTS folder_id UUID,
ADD COLUMN IF NOT EXISTS folder_name TEXT,
ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Create folders table for organizing conversations
CREATE TABLE IF NOT EXISTS ai_assistant_folders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    color TEXT, -- Optional: hex color for folder
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(admin_user_id, name)
);

-- Add embeddings to messages for semantic search
ALTER TABLE ai_assistant_messages 
ADD COLUMN IF NOT EXISTS embedding vector(1536), -- OpenAI ada-002 embedding dimension
ADD COLUMN IF NOT EXISTS is_knowledge_base BOOLEAN DEFAULT false, -- Mark for shared knowledge
ADD COLUMN IF NOT EXISTS summary TEXT; -- Auto-generated summary for knowledge base

-- Create shared knowledge base table (accessible to all admins)
CREATE TABLE IF NOT EXISTS ai_knowledge_base (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_conversation_id UUID REFERENCES ai_assistant_conversations(id) ON DELETE SET NULL,
    source_message_id UUID REFERENCES ai_assistant_messages(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    embedding vector(1536), -- Vector embedding for semantic search
    category TEXT, -- e.g., 'bid_insights', 'carrier_patterns', 'system_usage'
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    relevance_score DECIMAL(5,2), -- How relevant/important this knowledge is
    access_count INTEGER DEFAULT 0, -- Track how often this knowledge is retrieved
    created_by_admin_id TEXT NOT NULL, -- Admin who created this knowledge
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create memory chunks table (extracted insights from conversations)
CREATE TABLE IF NOT EXISTS ai_memory_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES ai_assistant_conversations(id) ON DELETE CASCADE,
    admin_user_id TEXT NOT NULL,
    chunk_text TEXT NOT NULL,
    embedding vector(1536),
    chunk_type TEXT CHECK (chunk_type IN ('insight', 'fact', 'pattern', 'preference', 'instruction')),
    metadata JSONB, -- Additional context about the chunk
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_assistant_conversations_folder_id 
    ON ai_assistant_conversations(folder_id);
CREATE INDEX IF NOT EXISTS idx_ai_assistant_conversations_admin_updated 
    ON ai_assistant_conversations(admin_user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_assistant_folders_admin_user_id 
    ON ai_assistant_folders(admin_user_id);

-- Vector similarity search indexes (using HNSW for fast approximate search)
CREATE INDEX IF NOT EXISTS idx_ai_assistant_messages_embedding 
    ON ai_assistant_messages 
    USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_ai_knowledge_base_embedding 
    ON ai_knowledge_base 
    USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_ai_memory_chunks_embedding 
    ON ai_memory_chunks 
    USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_ai_memory_chunks_admin_user_id 
    ON ai_memory_chunks(admin_user_id);

CREATE INDEX IF NOT EXISTS idx_ai_knowledge_base_category 
    ON ai_knowledge_base(category);

-- Function to find similar memories using vector search
CREATE OR REPLACE FUNCTION find_similar_memories(
    query_embedding vector(1536),
    p_admin_user_id TEXT,
    p_limit INTEGER DEFAULT 5,
    p_similarity_threshold FLOAT DEFAULT 0.7
)
RETURNS TABLE (
    id UUID,
    chunk_text TEXT,
    chunk_type TEXT,
    similarity FLOAT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        mc.id,
        mc.chunk_text,
        mc.chunk_type,
        1 - (mc.embedding <=> query_embedding) as similarity,
        mc.metadata,
        mc.created_at
    FROM ai_memory_chunks mc
    WHERE mc.admin_user_id = p_admin_user_id
    AND 1 - (mc.embedding <=> query_embedding) > p_similarity_threshold
    ORDER BY mc.embedding <=> query_embedding
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to find relevant knowledge base entries
CREATE OR REPLACE FUNCTION find_relevant_knowledge(
    query_embedding vector(1536),
    p_category TEXT DEFAULT NULL,
    p_limit INTEGER DEFAULT 5,
    p_similarity_threshold FLOAT DEFAULT 0.7
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    category TEXT,
    similarity FLOAT,
    tags TEXT[],
    access_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        kb.id,
        kb.content,
        kb.category,
        1 - (kb.embedding <=> query_embedding) as similarity,
        kb.tags,
        kb.access_count
    FROM ai_knowledge_base kb
    WHERE (p_category IS NULL OR kb.category = p_category)
    AND kb.embedding IS NOT NULL
    AND 1 - (kb.embedding <=> query_embedding) > p_similarity_threshold
    ORDER BY kb.embedding <=> query_embedding
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to update knowledge base access count
CREATE OR REPLACE FUNCTION increment_knowledge_access(kb_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE ai_knowledge_base
    SET access_count = access_count + 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = kb_id;
END;
$$ LANGUAGE plpgsql;

-- Add comments
COMMENT ON TABLE ai_assistant_folders IS 'Folders for organizing AI conversations';
COMMENT ON TABLE ai_knowledge_base IS 'Shared knowledge base accessible to all admins';
COMMENT ON TABLE ai_memory_chunks IS 'Personal memory chunks extracted from conversations for each admin';
COMMENT ON COLUMN ai_assistant_messages.embedding IS 'Vector embedding for semantic search (OpenAI ada-002, 1536 dimensions)';
COMMENT ON COLUMN ai_knowledge_base.embedding IS 'Vector embedding for semantic search in shared knowledge';
COMMENT ON COLUMN ai_memory_chunks.embedding IS 'Vector embedding for personal memory recall';

