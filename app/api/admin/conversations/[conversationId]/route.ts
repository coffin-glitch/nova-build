import { getClerkUserRole } from "@/lib/clerk-server";
import sql from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const userRole = await getClerkUserRole(userId);
    if (userRole !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { conversationId } = await params;

    // Verify the user has access to this conversation
    const conversation = await sql`
      SELECT id FROM conversations 
      WHERE id = ${conversationId} AND admin_user_id = ${userId}
    `;

    if (conversation.length === 0) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    // Get messages for this conversation
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
      LEFT JOIN message_reads mr ON mr.message_id = cm.id AND mr.user_id = ${userId}
      WHERE cm.conversation_id = ${conversationId}
      ORDER BY cm.created_at ASC
    `;

    return NextResponse.json({ 
      ok: true, 
      data: messages 
    });

  } catch (error) {
    console.error("Error fetching admin conversation messages:", error);
    return NextResponse.json({ 
      error: "Failed to fetch conversation messages" 
    }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const userRole = await getClerkUserRole(userId);
    if (userRole !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { conversationId } = await params;
    const body = await req.json();
    const { message } = body;

    if (!message) {
      return NextResponse.json({ 
        error: "Missing required field: message" 
      }, { status: 400 });
    }

    // Verify the user has access to this conversation
    const conversation = await sql`
      SELECT id FROM conversations 
      WHERE id = ${conversationId} AND admin_user_id = ${userId}
    `;

    if (conversation.length === 0) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    // Create new message
    const result = await sql`
      INSERT INTO conversation_messages (
        conversation_id,
        sender_id,
        sender_type,
        message,
        created_at,
        updated_at
      ) VALUES (${conversationId}, ${userId}, 'admin', ${message}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id, created_at
    `;

    return NextResponse.json({ 
      ok: true, 
      message: "Message sent successfully",
      data: result[0]
    });

  } catch (error) {
    console.error("Error sending admin message:", error);
    return NextResponse.json({ 
      error: "Failed to send message" 
    }, { status: 500 });
  }
}
