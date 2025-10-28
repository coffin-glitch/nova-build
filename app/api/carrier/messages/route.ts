import sql from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check carrier profile status
    const profile = await sql`
      SELECT profile_status FROM carrier_profiles 
      WHERE clerk_user_id = ${userId}
    `;

    const profileStatus = profile[0]?.profile_status;

    // Get messages for the current carrier
    let messages;
    
    if (profileStatus === 'approved') {
      // For approved carriers, only show regular admin messages (not appeal messages)
      messages = await sql`
        SELECT 
          id,
          carrier_user_id,
          admin_user_id,
          subject,
          message,
          is_read,
          read_at,
          created_at,
          updated_at
        FROM admin_messages 
        WHERE carrier_user_id = ${userId}
        ORDER BY created_at DESC
      `;
    } else {
      // For non-approved carriers, show all messages including appeal messages
      // This includes both admin_messages and appeal conversations converted to admin_messages format
      const adminMessages = await sql`
        SELECT 
          id,
          carrier_user_id,
          admin_user_id,
          subject,
          message,
          is_read,
          read_at,
          created_at,
          updated_at
        FROM admin_messages 
        WHERE carrier_user_id = ${userId}
        ORDER BY created_at DESC
      `;

      // Get appeal conversations and convert them to admin_messages format
      const appealConversations = await sql`
        SELECT 
          c.id as conversation_id,
          c.admin_user_id,
          c.carrier_user_id,
          cm.message,
          cm.created_at,
          cm.id as message_id,
          CASE WHEN mr.id IS NULL THEN false ELSE true END as is_read,
          mr.created_at as read_at,
          cm.created_at as updated_at
        FROM conversations c
        JOIN conversation_messages cm ON cm.conversation_id = c.id
        LEFT JOIN message_reads mr ON mr.message_id = cm.id AND mr.user_id = ${userId}
        WHERE c.carrier_user_id = ${userId} 
          AND c.conversation_type = 'appeal'
          AND cm.sender_type = 'admin'
        ORDER BY cm.created_at DESC
      `;

      // Convert appeal conversations to admin_messages format
      const appealMessages = appealConversations.map(conv => ({
        id: conv.message_id,
        carrier_user_id: conv.carrier_user_id,
        admin_user_id: conv.admin_user_id,
        subject: 'Appeal Decision',
        message: conv.message,
        is_read: conv.is_read,
        read_at: conv.read_at,
        created_at: conv.created_at,
        updated_at: conv.updated_at
      }));

      // Combine and sort all messages
      messages = [...adminMessages, ...appealMessages].sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }

    return NextResponse.json({ 
      ok: true, 
      data: messages 
    });

  } catch (error) {
    console.error("Error fetching carrier messages:", error);
    return NextResponse.json({ 
      error: "Failed to fetch messages" 
    }, { status: 500 });
  }
}
