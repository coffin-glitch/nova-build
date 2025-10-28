import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import sql from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get conversations for the current carrier with unread counts
    const conversations = await sql`
      SELECT 
        c.id as conversation_id,
        c.admin_user_id,
        c.status,
        c.subject,
        c.created_at,
        c.updated_at,
        c.closed_at,
        COUNT(CASE WHEN mr.id IS NULL AND cm.sender_type = 'admin' THEN 1 END) as unread_count,
        (
          SELECT cm2.message_text 
          FROM conversation_messages cm2 
          WHERE cm2.conversation_id = c.id 
          ORDER BY cm2.created_at DESC 
          LIMIT 1
        ) as last_message,
        (
          SELECT cm2.sender_type 
          FROM conversation_messages cm2 
          WHERE cm2.conversation_id = c.id 
          ORDER BY cm2.created_at DESC 
          LIMIT 1
        ) as last_message_sender_type,
        (
          SELECT cm2.created_at 
          FROM conversation_messages cm2 
          WHERE cm2.conversation_id = c.id 
          ORDER BY cm2.created_at DESC 
          LIMIT 1
        ) as last_message_at
      FROM conversations c
      LEFT JOIN conversation_messages cm ON cm.conversation_id = c.id
      LEFT JOIN message_reads mr ON mr.message_id = cm.id AND mr.user_id = ${userId}
      WHERE c.carrier_user_id = ${userId}
      GROUP BY c.id, c.admin_user_id, c.status, c.subject, c.created_at, c.updated_at, c.closed_at
      ORDER BY c.updated_at DESC
    `;

    logSecurityEvent('carrier_conversations_accessed', userId);
    
    const response = NextResponse.json({ 
      ok: true, 
      data: conversations 
    });
    
    return addSecurityHeaders(response);

  } catch (error) {
    console.error("Error fetching conversations:", error);
    logSecurityEvent('carrier_conversations_error', undefined, { error: error instanceof Error ? error.message : String(error) });
    
    const response = NextResponse.json({ 
      error: "Failed to fetch conversations" 
    }, { status: 500 });
    
    return addSecurityHeaders(response);
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { message, admin_user_id } = body;

    // Input validation
    const validation = validateInput({ message, admin_user_id }, {
      message: { required: true, type: 'string', minLength: 1, maxLength: 1000 },
      admin_user_id: { type: 'string', minLength: 1 }
    });

    if (!validation.valid) {
      logSecurityEvent('invalid_conversation_input', userId, { errors: validation.errors });
      return NextResponse.json({ 
        error: `Invalid input: ${validation.errors.join(', ')}` 
      }, { status: 400 });
    }

    // If no specific admin is provided, find any admin user
    let targetAdminId = admin_user_id;
    if (!targetAdminId) {
      const admins = await sql`
        SELECT clerk_user_id FROM user_roles 
        WHERE role = 'admin' 
        LIMIT 1
      `;
      if (admins.length > 0) {
        targetAdminId = admins[0].clerk_user_id;
      } else {
        return NextResponse.json({ 
          error: "No admin users available" 
        }, { status: 400 });
      }
    }

    // Check if conversation already exists
    const existingConversation = await sql`
      SELECT id FROM conversations 
      WHERE carrier_user_id = ${userId} AND admin_user_id = ${targetAdminId}
    `;

    let conversationId;
    if (existingConversation.length > 0) {
      conversationId = existingConversation[0].id;
    } else {
      // Create new conversation
      const conversationResult = await sql`
        INSERT INTO conversations (
          carrier_user_id,
          admin_user_id,
          status,
          created_at,
          updated_at
        ) VALUES (${userId}, ${targetAdminId}, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id
      `;
      conversationId = conversationResult[0].id;
    }

    // Create the initial message
    const messageResult = await sql`
      INSERT INTO conversation_messages (
        conversation_id,
        sender_user_id,
        sender_type,
        message_text
      ) VALUES (${conversationId}, ${userId}, 'carrier', ${message})
      RETURNING id, created_at
    `;

    logSecurityEvent('conversation_created', userId, { conversationId, messageId: messageResult[0].id });
    
    const response = NextResponse.json({ 
      ok: true, 
      message: "Conversation created and message sent successfully",
      data: { 
        conversation_id: conversationId,
        message_id: messageResult[0].id,
        created_at: messageResult[0].created_at
      }
    });
    
    return addSecurityHeaders(response);

  } catch (error) {
    console.error("Error creating conversation:", error);
    logSecurityEvent('conversation_creation_error', undefined, { error: error instanceof Error ? error.message : String(error) });
    
    const response = NextResponse.json({ 
      error: "Failed to create conversation" 
    }, { status: 500 });
    
    return addSecurityHeaders(response);
  }
}
