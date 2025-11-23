import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
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

    const body = await request.json();
    const { conversationId } = body;

    // Input validation
    const validation = validateInput(
      { conversationId },
      {
        conversationId: { required: true, type: 'string', pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, maxLength: 50 }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_ai_knowledge_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    if (!conversationId) {
      const response = NextResponse.json(
        { error: "conversationId is required" },
        { status: 400 }
      );
      return addSecurityHeaders(response);
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

    logSecurityEvent('ai_knowledge_extracted', userId, { conversationId, insightsCount: storedInsights.length });
    
    const response = NextResponse.json({
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
    
    return addSecurityHeaders(response);
    
  } catch (error: any) {
    console.error("Knowledge extraction error:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('ai_knowledge_extraction_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      {
        error: "Failed to extract knowledge",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : "Unknown error")
          : undefined,
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}

