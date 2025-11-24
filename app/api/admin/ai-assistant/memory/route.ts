import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
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

    // Check rate limit for admin read operation (AI operations can be resource-intensive)
    const rateLimit = await checkApiRateLimit(request, {
      userId,
      routeType: 'readOnly'
    });

    if (!rateLimit.allowed) {
      const response = NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: `Too many requests. Please try again after ${rateLimit.retryAfter} seconds.`,
          retryAfter: rateLimit.retryAfter
        },
        { status: 429 }
      );
      return addRateLimitHeaders(addSecurityHeaders(response), rateLimit);
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query");

    // Input validation
    const validation = validateInput(
      { query },
      {
        query: { required: true, type: 'string', minLength: 1, maxLength: 1000 }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_ai_memory_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    if (!query) {
      const response = NextResponse.json(
        { error: "Query parameter is required" },
        { status: 400 }
      );
      return addSecurityHeaders(response);
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

    logSecurityEvent('ai_memory_retrieved', userId, { 
      personalMemoriesCount: personalMemories.length,
      knowledgeBaseCount: knowledgeBase.length
    });
    
    const response = NextResponse.json({
      personalMemories: personalMemories || [],
      knowledgeBase: knowledgeBase || [],
    });
    
    return addSecurityHeaders(response);
    
  } catch (error: any) {
    console.error("Memory recall error:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('ai_memory_recall_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      {
        error: "Failed to retrieve memories",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : "Unknown error")
          : undefined,
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}

