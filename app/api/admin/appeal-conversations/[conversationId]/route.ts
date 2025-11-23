import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    // Ensure user is admin (Supabase-only)
    const auth = await requireApiAdmin(request);
    const userId = auth.userId;

    // Check rate limit for admin read operation
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

    const { conversationId } = await params;

    // Input validation
    const validation = validateInput(
      { conversationId },
      {
        conversationId: { required: true, type: 'string', pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, maxLength: 50 }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_appeal_conversation_get_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // Verify the admin has access to this appeal conversation
    const conversation = await sql`
      SELECT id FROM conversations 
      WHERE id = ${conversationId} AND (supabase_admin_user_id = ${userId} OR supabase_admin_user_id IS NULL) AND conversation_type = 'appeal'
    `;

    if (conversation.length === 0) {
      logSecurityEvent('appeal_conversation_not_found', userId, { conversationId });
      const response = NextResponse.json(
        { error: "Appeal conversation not found" },
        { status: 404 }
      );
      return addSecurityHeaders(response);
    }

    // Get messages for this appeal conversation
    const messages = await sql`
      SELECT 
        cm.id,
        cm.supabase_sender_id as sender_id,
        cm.sender_type,
        cm.message,
        cm.created_at,
        cm.updated_at,
        CASE WHEN mr.id IS NOT NULL THEN true ELSE false END as is_read
      FROM conversation_messages cm
      LEFT JOIN message_reads mr ON mr.message_id = cm.id AND mr.supabase_user_id = ${userId}
      WHERE cm.conversation_id = ${conversationId}
      ORDER BY cm.created_at ASC
    `;

    logSecurityEvent('appeal_conversation_messages_accessed', userId, { conversationId, messageCount: messages.length });
    
    const response = NextResponse.json({ 
      ok: true, 
      data: messages 
    });
    
    return addRateLimitHeaders(addSecurityHeaders(response), rateLimit);

  } catch (error: any) {
    console.error("Error fetching admin appeal conversation messages:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('appeal_conversation_get_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json({ 
      error: "Failed to fetch appeal conversation messages",
      details: process.env.NODE_ENV === 'development' 
        ? (error instanceof Error ? error.message : 'Unknown error')
        : undefined
    }, { status: 500 });
    
    return addSecurityHeaders(response);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    // Ensure user is admin (Supabase-only)
    const auth = await requireApiAdmin(request);
    const userId = auth.userId;

    // Check rate limit for admin write operation
    const rateLimit = await checkApiRateLimit(request, {
      userId,
      routeType: 'admin'
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

    const { conversationId } = await params;

    // Input validation for conversationId
    const conversationIdValidation = validateInput(
      { conversationId },
      {
        conversationId: { required: true, type: 'string', pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, maxLength: 50 }
      }
    );

    if (!conversationIdValidation.valid) {
      logSecurityEvent('invalid_appeal_conversation_post_input', userId, { errors: conversationIdValidation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${conversationIdValidation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    const body = await request.json();
    const { message } = body;

    // Input validation for message
    const messageValidation = validateInput(
      { message },
      {
        message: { required: true, type: 'string', minLength: 1, maxLength: 5000 }
      }
    );

    if (!messageValidation.valid) {
      logSecurityEvent('invalid_appeal_message_input', userId, { errors: messageValidation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${messageValidation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // Verify the admin has access to this appeal conversation
    const conversation = await sql`
      SELECT id FROM conversations 
      WHERE id = ${conversationId} AND (supabase_admin_user_id = ${userId} OR supabase_admin_user_id IS NULL) AND conversation_type = 'appeal'
    `;

    if (conversation.length === 0) {
      logSecurityEvent('appeal_conversation_not_found_post', userId, { conversationId });
      const response = NextResponse.json(
        { error: "Appeal conversation not found" },
        { status: 404 }
      );
      return addSecurityHeaders(response);
    }

    // Create new appeal response message (Supabase-only)
    const result = await sql`
      INSERT INTO conversation_messages (
        conversation_id,
        supabase_sender_id,
        sender_type,
        message,
        created_at,
        updated_at
      ) VALUES (${conversationId}, ${userId}, 'admin', ${message}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id, created_at
    `;

    logSecurityEvent('appeal_response_sent', userId, { conversationId, messageLength: message.length });
    
    const response = NextResponse.json({ 
      ok: true, 
      message: "Appeal response sent successfully",
      data: result[0]
    });
    
    return addRateLimitHeaders(addSecurityHeaders(response), rateLimit);

  } catch (error: any) {
    console.error("Error sending appeal response:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('appeal_response_send_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json({ 
      error: "Failed to send appeal response",
      details: process.env.NODE_ENV === 'development' 
        ? (error instanceof Error ? error.message : 'Unknown error')
        : undefined
    }, { status: 500 });
    
    return addSecurityHeaders(response);
  }
}
