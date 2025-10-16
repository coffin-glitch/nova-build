import { getClerkUserRole } from "@/lib/clerk-server";
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

    const userRole = await getClerkUserRole(userId);
    if (userRole !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { conversationId } = params;

    // Verify the admin is part of this conversation
    const conversationCheck = await sql`
      SELECT id FROM conversations
      WHERE id = ${conversationId} AND admin_user_id = ${userId};
    `;

    if (conversationCheck.length === 0) {
      return NextResponse.json({ error: "Conversation not found or not authorized" }, { status: 404 });
    }

    // Find all messages in this conversation that are not sent by the current user
    // and have not yet been marked as read by the current user
    const unreadMessages = await sql`
      SELECT cm.id AS message_id
      FROM conversation_messages cm
      LEFT JOIN message_reads mr ON cm.id = mr.message_id AND mr.user_id = ${userId}
      WHERE cm.conversation_id = ${conversationId}
      AND cm.sender_id != ${userId} -- Only mark messages from others as read
      AND mr.id IS NULL;
    `;

    if (unreadMessages.length > 0) {
      // Insert read receipts for all unread messages
      const readInserts = unreadMessages.map(msg => ({
        message_id: msg.message_id,
        user_id: userId,
      }));

      await sql`
        INSERT INTO message_reads ${sql(readInserts, 'message_id', 'user_id')}
        ON CONFLICT (message_id, user_id) DO NOTHING;
      `;
    }

    return NextResponse.json({ ok: true, message: "Conversation marked as read" });
  } catch (error) {
    console.error("Error marking conversation as read:", error);
    return NextResponse.json({ error: "Failed to mark conversation as read" }, { status: 500 });
  }
}
