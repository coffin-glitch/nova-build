import sql from "@/lib/db";
import { requireApiCarrier } from "@/lib/auth-api-helper";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const auth = await requireApiCarrier(request);
    const userId = auth.userId;

    const { conversationId } = await params;

    // Verify the user has access to this conversation
    const conversation = await sql`
      SELECT id FROM conversations 
      WHERE id = ${conversationId} AND supabase_carrier_user_id = ${userId}
    `;

    if (conversation.length === 0) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
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
