import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { requireApiCarrier, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const auth = await requireApiCarrier(request);
    const userId = auth.userId;

    // Check rate limit for authenticated write operation
    const rateLimit = await checkApiRateLimit(request, {
      userId,
      routeType: 'authenticated'
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
        conversationId: { required: true, type: 'string', maxLength: 50 }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_conversation_read_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // Verify the user has access to this conversation
    const conversation = await sql`
      SELECT id FROM conversations 
      WHERE id = ${conversationId} AND supabase_carrier_user_id = ${userId}
    `;

    if (conversation.length === 0) {
      logSecurityEvent('conversation_read_unauthorized', userId, { conversationId });
      const response = NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
      return addSecurityHeaders(response);
    }

    // Mark all unread messages in this conversation as read
    // Note: message_reads uses supabase_user_id, not user_id
    // Use NOT EXISTS to prevent duplicates (no unique constraint exists on supabase_user_id yet)
    const unreadMessages = await sql`
      SELECT cm.id as message_id
      FROM conversation_messages cm
      WHERE cm.conversation_id = ${conversationId}
        AND cm.sender_type = 'admin'
        AND NOT EXISTS (
          SELECT 1 FROM message_reads mr 
          WHERE mr.message_id = cm.id AND mr.supabase_user_id = ${userId}
        )
    `;

    // Insert read records for each unread message
    if (unreadMessages.length > 0) {
      for (const msg of unreadMessages) {
        try {
          await sql`
            INSERT INTO message_reads (message_id, supabase_user_id, read_at)
            VALUES (${msg.message_id}, ${userId}, CURRENT_TIMESTAMP)
          `;
        } catch (err: any) {
          // Ignore duplicate key errors (in case constraint exists)
          if (err?.code !== '23505' && err?.code !== '42P10') {
            console.error('Error inserting read record:', err);
          }
        }
      }
    }

    logSecurityEvent('conversation_messages_marked_read', userId, { 
      conversationId,
      messageCount: unreadMessages.length
    });
    
    const response = NextResponse.json({ 
      ok: true, 
      message: "Messages marked as read" 
    });
    
    return addSecurityHeaders(response);

  } catch (error: any) {
    console.error("Error marking messages as read:", error);
    
    if (error.message === "Unauthorized" || error.message === "Carrier access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('conversation_read_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to mark messages as read",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}
