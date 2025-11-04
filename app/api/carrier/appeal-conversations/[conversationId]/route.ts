import sql from "@/lib/db";
import { requireApiCarrier } from "@/lib/auth-api-helper";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const auth = await requireApiCarrier(request);
    const userId = auth.userId;

    const { conversationId } = await params;

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
      LEFT JOIN message_reads mr ON mr.message_id = cm.id AND mr.user_id = ${userId}
      WHERE cm.conversation_id = ${conversationId}
      ORDER BY cm.created_at ASC
    `;

    return NextResponse.json({ 
      ok: true, 
      data: messages 
    });

  } catch (error) {
    console.error("Error fetching appeal conversation messages:", error);
    return NextResponse.json({ 
      error: "Failed to fetch appeal conversation messages" 
    }, { status: 500 });
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

    if (!message) {
      return NextResponse.json({ 
        error: "Missing required field: message" 
      }, { status: 400 });
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

    return NextResponse.json({ 
      ok: true, 
      message: "Appeal message sent successfully",
      data: result[0]
    });

  } catch (error) {
    console.error("Error sending appeal message:", error);
    return NextResponse.json({ 
      error: "Failed to send appeal message" 
    }, { status: 500 });
  }
}
