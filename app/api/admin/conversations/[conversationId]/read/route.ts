import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
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

    // Input validation
    const validation = validateInput(
      { conversationId },
      {
        conversationId: { required: true, type: 'string', pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, maxLength: 50 }
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

    logSecurityEvent('conversation_messages_marked_read', userId, { conversationId, unreadCount: unreadMessages.length });
    
    const response = NextResponse.json({ 
      ok: true, 
      message: "Messages marked as read" 
    });
    
    return addSecurityHeaders(response);

  } catch (error: any) {
    console.error("Error marking admin messages as read:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('conversation_read_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json({ 
      error: "Failed to mark messages as read",
      details: process.env.NODE_ENV === 'development' 
        ? (error instanceof Error ? error.message : 'Unknown error')
        : undefined
    }, { status: 500 });
    
    return addSecurityHeaders(response);
  }
}