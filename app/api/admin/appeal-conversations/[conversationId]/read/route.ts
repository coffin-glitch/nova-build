import { requireApiAdmin } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: { conversationId: string } }
) {
  try {
    // Ensure user is admin (Supabase-only)
    const auth = await requireApiAdmin(request);
    const userId = auth.userId;

    const { conversationId } = await params;

    // Verify the admin has access to this appeal conversation
    const conversation = await sql`
      SELECT id FROM conversations 
      WHERE id = ${conversationId} AND (admin_user_id = ${userId} OR admin_user_id = 'admin_system') AND conversation_type = 'appeal'
    `;

    if (conversation.length === 0) {
      return NextResponse.json({ error: "Appeal conversation not found" }, { status: 404 });
    }

    // Mark all unread carrier messages in this appeal conversation as read by the admin
    await sql`
      INSERT INTO message_reads (message_id, user_id, read_at)
      SELECT 
        cm.id,
        ${userId},
        CURRENT_TIMESTAMP
      FROM conversation_messages cm
      LEFT JOIN message_reads mr ON mr.message_id = cm.id AND mr.user_id = ${userId}
      WHERE cm.conversation_id = ${conversationId}
        AND cm.sender_type = 'carrier'
        AND mr.id IS NULL
      ON CONFLICT (message_id, user_id) DO NOTHING
    `;

    return NextResponse.json({ 
      ok: true, 
      message: "Appeal messages marked as read" 
    });

  } catch (error) {
    console.error("Error marking appeal messages as read:", error);
    return NextResponse.json({ 
      error: "Failed to mark appeal messages as read" 
    }, { status: 500 });
  }
}
