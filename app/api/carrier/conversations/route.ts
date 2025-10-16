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
        c.last_message_at,
        c.created_at,
        c.updated_at,
        COUNT(CASE WHEN mr.id IS NULL AND cm.sender_type = 'admin' THEN 1 END) as unread_count,
        (
          SELECT cm2.message 
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
        ) as last_message_sender_type
      FROM conversations c
      LEFT JOIN conversation_messages cm ON cm.conversation_id = c.id
      LEFT JOIN message_reads mr ON mr.message_id = cm.id AND mr.user_id = ${userId}
      WHERE c.carrier_user_id = ${userId}
      GROUP BY c.id, c.admin_user_id, c.last_message_at, c.created_at, c.updated_at
      ORDER BY c.last_message_at DESC
    `;

    return NextResponse.json({ 
      ok: true, 
      data: conversations 
    });

  } catch (error) {
    console.error("Error fetching conversations:", error);
    return NextResponse.json({ 
      error: "Failed to fetch conversations" 
    }, { status: 500 });
  }
}
