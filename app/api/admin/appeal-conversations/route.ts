import { requireApiAdmin } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // Ensure user is admin (Supabase-only)
    const auth = await requireApiAdmin(request);
    const userId = auth.userId;

    // Get appeal conversations for the current admin with unread counts
    const conversations = await sql`
      SELECT 
        c.id as conversation_id,
        c.supabase_carrier_user_id as carrier_user_id,
        c.last_message_at,
        c.created_at,
        c.updated_at,
        COUNT(CASE WHEN mr.id IS NULL AND cm.sender_type = 'carrier' AND cm.supabase_sender_id != ${userId} THEN 1 END) as unread_count,
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
      LEFT JOIN message_reads mr ON mr.message_id = cm.id AND mr.supabase_user_id = ${userId}
      WHERE c.conversation_type = 'appeal' AND (c.supabase_admin_user_id = ${userId} OR c.supabase_admin_user_id IS NULL)
      GROUP BY c.id, c.supabase_carrier_user_id, c.last_message_at, c.created_at, c.updated_at
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

export async function POST(request: NextRequest) {
  try {
    // Ensure user is admin (Supabase-only)
    const auth = await requireApiAdmin(request);
    const userId = auth.userId;
    console.log('Admin appeal conversation POST - userId:', userId);

    const body = await request.json();
    const { carrier_user_id } = body;
    console.log('Admin appeal conversation POST - carrier_user_id:', carrier_user_id);

    if (!carrier_user_id) {
      return NextResponse.json({ 
        error: "Missing required field: carrier_user_id" 
      }, { status: 400 });
    }

    // Check if appeal conversation already exists (either with current admin or unassigned)
    const existingConversation = await sql`
      SELECT id, supabase_admin_user_id FROM conversations 
      WHERE supabase_carrier_user_id = ${carrier_user_id} 
      AND conversation_type = 'appeal'
      AND (supabase_admin_user_id = ${userId} OR supabase_admin_user_id IS NULL)
    `;

    if (existingConversation.length > 0) {
      // If the conversation exists unassigned, update it to use current admin
      if (existingConversation[0].supabase_admin_user_id === null) {
        await sql`
          UPDATE conversations 
          SET supabase_admin_user_id = ${userId}
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
    // Create new appeal conversation (Supabase-only)
    const result = await sql`
      INSERT INTO conversations (
        supabase_carrier_user_id,
        supabase_admin_user_id,
        subject,
        status,
        conversation_type,
        created_at,
        updated_at
      ) VALUES (${carrier_user_id}, ${userId}, 'Profile Appeal', 'active', 'appeal', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
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
