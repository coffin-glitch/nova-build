import { forbiddenResponse, requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // Supabase auth only
    const auth = await requireApiAdmin(request);
    const userId = auth.userId;

    // Get conversations for the current admin with unread counts
    // Note: carrier_user_id was removed in migration 078, only supabase_carrier_user_id exists
    const conversations = await sql`
      SELECT 
        c.id as conversation_id,
        c.supabase_carrier_user_id as carrier_user_id,
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
      LEFT JOIN message_reads mr ON mr.message_id = cm.id AND mr.supabase_user_id = ${userId}
      WHERE c.supabase_admin_user_id = ${userId}
      GROUP BY c.id, c.supabase_carrier_user_id, c.last_message_at, c.created_at, c.updated_at
      ORDER BY c.last_message_at DESC
    `;

    return NextResponse.json({ 
      ok: true, 
      data: conversations 
    });

  } catch (error: any) {
    console.error("Error fetching admin conversations:", error);
    
    // Handle auth errors
    if (error.message === "Unauthorized") {
      return unauthorizedResponse();
    }
    if (error.message === "Admin access required" || error.message?.includes("Forbidden")) {
      return forbiddenResponse(error.message || "Admin access required");
    }
    
    return NextResponse.json({ 
      error: "Failed to fetch conversations" 
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    // Supabase auth only
    const auth = await requireApiAdmin(req);
    const userId = auth.userId;

    const body = await req.json();
    const { carrier_user_id } = body;

    if (!carrier_user_id) {
      return NextResponse.json({ 
        error: "Missing required field: carrier_user_id" 
      }, { status: 400 });
    }

    // Check if conversation already exists (Supabase-only)
    const existingConversation = await sql`
      SELECT id FROM conversations 
      WHERE supabase_carrier_user_id = ${carrier_user_id}
        AND supabase_admin_user_id = ${userId}
    `;

    if (existingConversation.length > 0) {
      return NextResponse.json({ 
        ok: true, 
        conversation_id: existingConversation[0].id,
        message: "Conversation already exists"
      });
    }

    // Create new conversation (Supabase-only)
    const result = await sql`
      INSERT INTO conversations (
        supabase_carrier_user_id,
        supabase_admin_user_id,
        subject,
        status,
        conversation_type,
        created_at,
        updated_at
      ) VALUES (
        ${carrier_user_id}, 
        ${userId},
        'Admin Chat', 
        'active', 
        'regular', 
        CURRENT_TIMESTAMP, 
        CURRENT_TIMESTAMP
      )
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