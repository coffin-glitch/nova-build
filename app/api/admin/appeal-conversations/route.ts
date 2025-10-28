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

    // Get appeal conversations for the current admin with unread counts
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
      WHERE c.conversation_type = 'appeal' AND (c.admin_user_id = ${userId} OR c.admin_user_id = 'admin_system')
      GROUP BY c.id, c.carrier_user_id, c.last_message_at, c.created_at, c.updated_at
      ORDER BY c.last_message_at DESC
    `;

    return NextResponse.json({ 
      ok: true, 
      data: conversations 
    });

  } catch (error) {
    console.error("Error fetching admin appeal conversations:", error);
    return NextResponse.json({ 
      error: "Failed to fetch appeal conversations" 
    }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    console.log('Admin appeal conversation POST - userId:', userId);
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const userRole = await getClerkUserRole(userId);
    console.log('Admin appeal conversation POST - userRole:', userRole);
    if (userRole !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { carrier_user_id } = body;
    console.log('Admin appeal conversation POST - carrier_user_id:', carrier_user_id);

    if (!carrier_user_id) {
      return NextResponse.json({ 
        error: "Missing required field: carrier_user_id" 
      }, { status: 400 });
    }

    // Check if appeal conversation already exists (either with current admin or admin_system)
    const existingConversation = await sql`
      SELECT id, admin_user_id FROM conversations 
      WHERE carrier_user_id = ${carrier_user_id} 
      AND conversation_type = 'appeal'
      AND (admin_user_id = ${userId} OR admin_user_id = 'admin_system')
    `;

    if (existingConversation.length > 0) {
      // If the conversation exists with admin_system, update it to use current admin
      if (existingConversation[0].admin_user_id === 'admin_system') {
        await sql`
          UPDATE conversations 
          SET admin_user_id = ${userId}
          WHERE id = ${existingConversation[0].id}
        `;
        console.log(`Updated appeal conversation ${existingConversation[0].id} to use current admin`);
      }
      
      return NextResponse.json({ 
        ok: true, 
        conversation_id: existingConversation[0].id,
        message: "Appeal conversation already exists"
      });
    }

    // Create new appeal conversation
    console.log('Creating new appeal conversation...');
    const result = await sql`
      INSERT INTO conversations (
        carrier_user_id,
        admin_user_id,
        conversation_type,
        created_at,
        updated_at
      ) VALUES (${carrier_user_id}, ${userId}, 'appeal', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id
    `;
    console.log('Appeal conversation created:', result);

    return NextResponse.json({ 
      ok: true, 
      conversation_id: result[0].id,
      message: "Appeal conversation created successfully"
    });

  } catch (error) {
    console.error("Error creating admin appeal conversation:", error);
    return NextResponse.json({ 
      error: "Failed to create appeal conversation" 
    }, { status: 500 });
  }
}
