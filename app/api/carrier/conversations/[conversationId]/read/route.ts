import sql from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  { params }: { params: { conversationId: string } }
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { conversationId } = params;

    // Verify the user has access to this conversation
    const conversation = await sql`
      SELECT id FROM conversations 
      WHERE id = ${conversationId} AND carrier_user_id = ${userId}
    `;

    if (conversation.length === 0) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    // Mark all unread messages in this conversation as read
    await sql`
      INSERT INTO message_reads (message_id, user_id, read_at)
      SELECT 
        cm.id,
        ${userId},
        CURRENT_TIMESTAMP
      FROM conversation_messages cm
      LEFT JOIN message_reads mr ON mr.message_id = cm.id AND mr.user_id = ${userId}
      WHERE cm.conversation_id = ${conversationId}
        AND cm.sender_type = 'admin'
        AND mr.id IS NULL
      ON CONFLICT (message_id, user_id) DO NOTHING
    `;

    return NextResponse.json({ 
      ok: true, 
      message: "Messages marked as read" 
    });

  } catch (error) {
    console.error("Error marking messages as read:", error);
    return NextResponse.json({ 
      error: "Failed to mark messages as read" 
    }, { status: 500 });
  }
}
