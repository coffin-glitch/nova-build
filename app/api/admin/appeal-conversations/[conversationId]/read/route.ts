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
      WHERE id = ${conversationId} AND (supabase_admin_user_id = ${userId} OR supabase_admin_user_id IS NULL) AND conversation_type = 'appeal'
    `;

    if (conversation.length === 0) {
      return NextResponse.json({ error: "Appeal conversation not found" }, { status: 404 });
    }

    // Mark all unread carrier messages in this appeal conversation as read by the admin
    // Note: message_reads uses supabase_user_id, not user_id
    const unreadMessages = await sql`
      SELECT cm.id as message_id
      FROM conversation_messages cm
      WHERE cm.conversation_id = ${conversationId}
        AND cm.sender_type = 'carrier'
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
