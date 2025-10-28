import { getClerkUserRole } from "@/lib/clerk-server";
import sql from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const userRole = await getClerkUserRole(userId);
    if (userRole !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get conversations for the current admin with unread counts
    const conversations = await sql`
      SELECT 
        c.id as conversation_id,
        c.carrier_user_id,
        c.last_message_at,
        c.created_at,
        c.updated_at,
        COUNT(CASE WHEN mr.id IS NULL AND cm.sender_type = 'carrier' THEN 1 END) as unread_count,
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
      WHERE c.admin_user_id = ${userId}
      GROUP BY c.id, c.carrier_user_id, c.last_message_at, c.created_at, c.updated_at
      ORDER BY c.last_message_at DESC
    `;

    return NextResponse.json({ 
      ok: true, 
      data: conversations 
    });

  } catch (error) {
    console.error("Error fetching admin conversations:", error);
    return NextResponse.json({ 
      error: "Failed to fetch conversations" 
    }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const userRole = await getClerkUserRole(userId);
    if (userRole !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { carrier_user_id } = body;

    if (!carrier_user_id) {
      return NextResponse.json({ 
        error: "Missing required field: carrier_user_id" 
      }, { status: 400 });
    }

    // Check if conversation already exists
    const existingConversation = await sql`
      SELECT id FROM conversations 
      WHERE carrier_user_id = ${carrier_user_id} AND admin_user_id = ${userId}
    `;

    if (existingConversation.length > 0) {
      return NextResponse.json({ 
        ok: true, 
        conversation_id: existingConversation[0].id,
        message: "Conversation already exists"
      });
    }

    // Create new conversation
    const result = await sql`
      INSERT INTO conversations (
        carrier_user_id,
        admin_user_id,
        created_at,
        updated_at
      ) VALUES (${carrier_user_id}, ${userId}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id
    `;

    return NextResponse.json({ 
      ok: true, 
      conversation_id: result[0].id,
      message: "Conversation created successfully"
    });

  } catch (error) {
    console.error("Error creating admin conversation:", error);
    return NextResponse.json({ 
      error: "Failed to create conversation" 
    }, { status: 500 });
  }
}