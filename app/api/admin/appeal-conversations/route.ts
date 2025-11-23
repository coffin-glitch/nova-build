import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
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

    logSecurityEvent('admin_appeal_conversations_accessed', userId);
    
    const response = NextResponse.json({ 
      ok: true, 
      data: conversations 
    });
    
    return addSecurityHeaders(response);

  } catch (error: any) {
    console.error("Error fetching admin appeal conversations:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('admin_appeal_conversations_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json({ 
      error: process.env.NODE_ENV === 'development' 
        ? (error.message || "Failed to fetch appeal conversations")
        : "Failed to fetch appeal conversations"
    }, { status: 500 });
    
    return addSecurityHeaders(response);
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

    // Input validation
    const validation = validateInput(
      { carrier_user_id },
      {
        carrier_user_id: { required: true, type: 'string', pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, maxLength: 50 }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_appeal_conversation_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    if (!carrier_user_id) {
      const response = NextResponse.json({ 
        error: "Missing required field: carrier_user_id" 
      }, { status: 400 });
      return addSecurityHeaders(response);
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

    logSecurityEvent('appeal_conversation_created', userId, { carrierUserId: carrier_user_id, conversationId: result[0].id });
    
    const response = NextResponse.json({ 
      ok: true, 
      conversation_id: result[0].id,
      message: "Appeal conversation created successfully"
    });
    
    return addSecurityHeaders(response);

  } catch (error: any) {
    console.error("Error creating admin appeal conversation:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('appeal_conversation_create_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json({ 
      error: process.env.NODE_ENV === 'development' 
        ? (error.message || "Failed to create appeal conversation")
        : "Failed to create appeal conversation"
    }, { status: 500 });
    
    return addSecurityHeaders(response);
  }
}
