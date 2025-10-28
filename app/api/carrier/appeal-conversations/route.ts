import sql from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get appeal conversations for the current carrier with unread counts
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
      WHERE c.carrier_user_id = ${userId} AND c.conversation_type = 'appeal'
      GROUP BY c.id, c.admin_user_id, c.last_message_at, c.created_at, c.updated_at
      ORDER BY c.last_message_at DESC
    `;

    return NextResponse.json({ 
      ok: true, 
      data: conversations 
    });

  } catch (error) {
    console.error("Error fetching appeal conversations:", error);
    return NextResponse.json({ 
      error: "Failed to fetch appeal conversations" 
    }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { message, admin_user_id } = body;

    if (!message) {
      return NextResponse.json({ 
        error: "Missing required field: message" 
      }, { status: 400 });
    }

    // If no specific admin is provided, use a default admin ID for appeals
    let targetAdminId = admin_user_id;
    if (!targetAdminId) {
      targetAdminId = 'admin_system'; // Default admin for appeals
    }

    // Check if appeal conversation already exists
    const existingConversation = await sql`
      SELECT id FROM conversations 
      WHERE carrier_user_id = ${userId} AND admin_user_id = ${targetAdminId} AND conversation_type = 'appeal'
    `;

    let conversationId;
    if (existingConversation.length > 0) {
      conversationId = existingConversation[0].id;
    } else {
      // Create new appeal conversation
      const conversationResult = await sql`
        INSERT INTO conversations (
          carrier_user_id,
          admin_user_id,
          conversation_type,
          created_at,
          updated_at
        ) VALUES (${userId}, ${targetAdminId}, 'appeal', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id
      `;
      conversationId = conversationResult[0].id;
    }

    // Create the appeal message
    const messageResult = await sql`
      INSERT INTO conversation_messages (
        conversation_id,
        sender_id,
        sender_type,
        message,
        created_at,
        updated_at
      ) VALUES (${conversationId}, ${userId}, 'carrier', ${message}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id, created_at
    `;

    return NextResponse.json({ 
      ok: true,
      message: "Appeal message sent successfully",
      data: { 
        conversation_id: conversationId,
        message_id: messageResult[0].id,
        created_at: messageResult[0].created_at
      }
    });

  } catch (error) {
    console.error("Error creating appeal conversation:", error);
    return NextResponse.json({ 
      error: "Failed to create appeal conversation" 
    }, { status: 500 });
  }
}
