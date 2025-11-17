import { requireApiAdmin } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { extractKnowledgeFromConversation, generateEmbedding } from "@/lib/ai-embeddings";

/**
 * POST /api/admin/ai-assistant/knowledge
 * Extract and store knowledge from a conversation
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiAdmin(request);
    const userId = auth.userId;

    const { conversationId } = await request.json();

    if (!conversationId) {
      return NextResponse.json(
        { error: "conversationId is required" },
        { status: 400 }
      );
    }

    // Get conversation messages
    const messages = await sql`
      SELECT role, content
      FROM ai_assistant_messages
      WHERE conversation_id = ${conversationId}::uuid
      ORDER BY created_at ASC
    `;

    if (messages.length === 0) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    // Extract knowledge using AI
    const extracted = await extractKnowledgeFromConversation(
      messages.map((m: any) => ({ role: m.role, content: m.content }))
    );

    // Generate embeddings for insights
    const insightEmbeddings = await Promise.all(
      extracted.insights.map(insight => generateEmbedding(insight))
    );

    // Store insights in knowledge base
    const storedInsights = [];
    for (let i = 0; i < extracted.insights.length; i++) {
      const insight = extracted.insights[i];
      const embedding = insightEmbeddings[i];

      const result = await sql`
        INSERT INTO ai_knowledge_base (
          source_conversation_id,
          content,
          embedding,
          category,
          tags,
          relevance_score,
          created_by_admin_id
        ) VALUES (
          ${conversationId}::uuid,
          ${insight},
          ${JSON.stringify(embedding)}::vector,
          ${extracted.category},
          ARRAY[]::TEXT[],
          0.8,
          ${userId}
        )
        RETURNING id, content, category
      `;

      storedInsights.push(result[0]);
    }

    // Also create memory chunks for personal recall
    const memoryChunks = [];
    for (let i = 0; i < extracted.insights.length; i++) {
      const insight = extracted.insights[i];
      const embedding = insightEmbeddings[i];

      const result = await sql`
        INSERT INTO ai_memory_chunks (
          conversation_id,
          admin_user_id,
          chunk_text,
          embedding,
          chunk_type,
          metadata
        ) VALUES (
          ${conversationId}::uuid,
          ${userId},
          ${insight},
          ${JSON.stringify(embedding)}::vector,
          'insight',
          ${JSON.stringify({ category: extracted.category, summary: extracted.summary })}
        )
        RETURNING id, chunk_text
      `;

      memoryChunks.push(result[0]);
    }

    return NextResponse.json({
      success: true,
      extracted: {
        insights: extracted.insights,
        summary: extracted.summary,
        category: extracted.category,
      },
      stored: {
        knowledgeBase: storedInsights.length,
        memoryChunks: memoryChunks.length,
      },
    });
  } catch (error) {
    console.error("Knowledge extraction error:", error);
    return NextResponse.json(
      {
        error: "Failed to extract knowledge",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

