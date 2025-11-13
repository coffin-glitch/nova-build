import { requireApiAdmin } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    // Ensure user is admin (Supabase-only)
    const auth = await requireApiAdmin(request);
    const userId = auth.userId;

    const { conversationId } = await params;

    // Verify the admin has access to this conversation
    // Allow access if user is admin_user_id OR if user is carrier_user_id (for admin-to-admin chats)
    const conversation = await sql`
      SELECT id, supabase_admin_user_id, supabase_carrier_user_id FROM conversations 
      WHERE id = ${conversationId} 
        AND (
          supabase_admin_user_id = ${userId}
          OR (supabase_carrier_user_id = ${userId} AND EXISTS (
            SELECT 1 FROM user_roles_cache ur 
            WHERE ur.supabase_user_id = ${userId} AND ur.role = 'admin'
          ))
        )
    `;

    if (conversation.length === 0) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    // Mark all unread messages in this conversation as read by the admin
    // Note: message_reads uses supabase_user_id, not user_id
    // Mark messages from anyone except the current user as read
    // (works for both admin-to-carrier and admin-to-admin conversations)
    const unreadMessages = await sql`
      SELECT cm.id as message_id
      FROM conversation_messages cm
      WHERE cm.conversation_id = ${conversationId}
        AND cm.supabase_sender_id != ${userId}
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
    console.error("Error marking admin messages as read:", error);
    return NextResponse.json({ 
      error: "Failed to mark messages as read" 
    }, { status: 500 });
  }
}