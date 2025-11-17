import { requireApiAdmin } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { generateEmbedding } from "@/lib/ai-embeddings";

/**
 * GET /api/admin/ai-assistant/memory
 * Retrieve relevant memories and knowledge base entries for a query
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiAdmin(request);
    const userId = auth.userId;

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query");

    if (!query) {
      return NextResponse.json(
        { error: "Query parameter is required" },
        { status: 400 }
      );
    }

    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query);

    // Find similar personal memories
    const personalMemories = await sql`
      SELECT 
        id,
        chunk_text,
        chunk_type,
        1 - (embedding <=> ${JSON.stringify(queryEmbedding)}::vector) as similarity,
        metadata,
        created_at
      FROM ai_memory_chunks
      WHERE admin_user_id = ${userId}
      AND embedding IS NOT NULL
      AND 1 - (embedding <=> ${JSON.stringify(queryEmbedding)}::vector) > 0.7
      ORDER BY embedding <=> ${JSON.stringify(queryEmbedding)}::vector
      LIMIT 5
    `;

    // Find relevant knowledge base entries
    const knowledgeBase = await sql`
      SELECT 
        id,
        content,
        category,
        1 - (embedding <=> ${JSON.stringify(queryEmbedding)}::vector) as similarity,
        tags,
        access_count
      FROM ai_knowledge_base
      WHERE embedding IS NOT NULL
      AND 1 - (embedding <=> ${JSON.stringify(queryEmbedding)}::vector) > 0.7
      ORDER BY embedding <=> ${JSON.stringify(queryEmbedding)}::vector
      LIMIT 5
    `;

    // Update access counts for retrieved knowledge
    if (knowledgeBase.length > 0) {
      const kbIds = knowledgeBase.map((kb: any) => kb.id);
      await sql`
        UPDATE ai_knowledge_base
        SET access_count = access_count + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ANY(${kbIds}::uuid[])
      `;
    }

    return NextResponse.json({
      personalMemories: personalMemories || [],
      knowledgeBase: knowledgeBase || [],
    });
  } catch (error) {
    console.error("Memory recall error:", error);
    return NextResponse.json(
      {
        error: "Failed to retrieve memories",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

