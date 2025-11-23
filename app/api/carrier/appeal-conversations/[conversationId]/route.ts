import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { requireApiCarrier, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const auth = await requireApiCarrier(request);
    const userId = auth.userId;

    const { conversationId } = await params;

    // Input validation
    const validation = validateInput(
      { conversationId },
      {
        conversationId: { required: true, type: 'string', maxLength: 50 }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_appeal_conversation_id_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // Verify the user has access to this appeal conversation
    const conversation = await sql`
      SELECT id FROM conversations 
      WHERE id = ${conversationId} AND supabase_carrier_user_id = ${userId} AND conversation_type = 'appeal'
    `;

    if (conversation.length === 0) {
      return NextResponse.json({ error: "Appeal conversation not found" }, { status: 404 });
    }

    // Get messages for this appeal conversation
    const messages = await sql`
      SELECT 
        cm.id,
        cm.sender_id,
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

    logSecurityEvent('appeal_conversation_messages_accessed', userId, { conversationId });
    
    const response = NextResponse.json({ 
      ok: true, 
      data: messages 
    });
    
    return addSecurityHeaders(response);

  } catch (error: any) {
    console.error("Error fetching appeal conversation messages:", error);
    
    if (error.message === "Unauthorized" || error.message === "Carrier access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('appeal_conversation_messages_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to fetch appeal conversation messages",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const auth = await requireApiCarrier(request);
    const userId = auth.userId;

    const { conversationId } = await params;
    const body = await request.json();
    const { message } = body;

    // Input validation
    const validation = validateInput(
      { conversationId, message },
      {
        conversationId: { required: true, type: 'string', maxLength: 50 },
        message: { required: true, type: 'string', minLength: 1, maxLength: 5000 }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_appeal_message_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    if (!message) {
      const response = NextResponse.json(
        { error: "Missing required field: message" },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // Verify the user has access to this appeal conversation
    const conversation = await sql`
      SELECT id FROM conversations 
      WHERE id = ${conversationId} AND supabase_carrier_user_id = ${userId} AND conversation_type = 'appeal'
    `;

    if (conversation.length === 0) {
      return NextResponse.json({ error: "Appeal conversation not found" }, { status: 404 });
    }

    // Create new appeal message
    const result = await sql`
      INSERT INTO conversation_messages (
        conversation_id,
        supabase_sender_id,
        sender_type,
        message,
        created_at,
        updated_at
      ) VALUES (
        ${conversationId}, 
        ${userId},
        'carrier', 
        ${message}, 
        CURRENT_TIMESTAMP, 
        CURRENT_TIMESTAMP
      )
      RETURNING id, created_at
    `;

    logSecurityEvent('appeal_message_sent', userId, { 
      conversationId,
      messageId: result[0].id
    });
    
    const response = NextResponse.json({ 
      ok: true, 
      message: "Appeal message sent successfully",
      data: result[0]
    });
    
    return addSecurityHeaders(response);

  } catch (error: any) {
    console.error("Error sending appeal message:", error);
    
    if (error.message === "Unauthorized" || error.message === "Carrier access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('appeal_message_send_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to send appeal message",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}
