import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { requireApiCarrier } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    let auth;
    try {
      auth = await requireApiCarrier(request);
    } catch (authError: any) {
      console.error('Auth error in carrier conversations GET:', authError);
      return NextResponse.json(
        { error: "Authentication failed", details: authError?.message || "Unauthorized" },
        { status: 401 }
      );
    }
    
    const userId = auth.userId;
    
    if (!userId) {
      console.error('No userId from auth in carrier conversations GET:', auth);
      return NextResponse.json(
        { error: "Authentication failed: no user ID" },
        { status: 401 }
      );
    }

    // Get conversations for the current carrier with unread counts
    // Query only columns that definitely exist in the conversations table
    let conversations;
    try {
      // First, get basic conversations
      // Note: carrier_user_id and admin_user_id were removed in migration 078
      // Only supabase_carrier_user_id and supabase_admin_user_id exist now
      const basicConversations = await sql`
        SELECT 
          c.id as conversation_id,
          c.supabase_admin_user_id as admin_user_id,
          c.created_at,
          c.updated_at
        FROM conversations c
        WHERE c.supabase_carrier_user_id = ${userId}
        ORDER BY c.updated_at DESC
      `;
      
      // Then enrich each conversation with message data
      conversations = await Promise.all(basicConversations.map(async (conv: any) => {
        // Get unread count
        const unreadResult = await sql`
          SELECT COUNT(*) as unread_count
          FROM conversation_messages cm
          LEFT JOIN message_reads mr ON mr.message_id = cm.id AND (mr.supabase_user_id = ${userId} OR mr.user_id = ${userId})
          WHERE cm.conversation_id = ${conv.conversation_id}
          AND cm.sender_type = 'admin'
          AND mr.id IS NULL
        `;
        
        // Get last message
        const lastMessageResult = await sql`
          SELECT message, sender_type, created_at
          FROM conversation_messages
          WHERE conversation_id = ${conv.conversation_id}
          ORDER BY created_at DESC
          LIMIT 1
        `;
        
        return {
          ...conv,
          unread_count: parseInt(unreadResult[0]?.unread_count || '0'),
          last_message: lastMessageResult[0]?.message || null,
          last_message_sender_type: lastMessageResult[0]?.sender_type || null,
          last_message_at: lastMessageResult[0]?.created_at || null
        };
      }));
    } catch (queryError: any) {
      console.error('[conversations GET] SQL query error:', queryError);
      console.error('[conversations GET] Error details:', {
        message: queryError?.message,
        code: queryError?.code,
        stack: queryError?.stack
      });
      throw queryError;
    }
    
    // Add default values for optional columns that might not exist in the database
    const conversationsWithDefaults = conversations.map((conv: any) => ({
      ...conv,
      status: 'active',
      subject: 'Chat with Admin',
      closed_at: null
    }));

    logSecurityEvent('carrier_conversations_accessed', userId);
    
    const response = NextResponse.json({ 
      ok: true, 
      data: conversationsWithDefaults 
    });
    
    return addSecurityHeaders(response);

  } catch (error: any) {
    console.error("Error fetching conversations:", error);
    console.error("Error details:", {
      message: error?.message,
      code: error?.code,
      stack: error?.stack
    });
    logSecurityEvent('carrier_conversations_error', undefined, { error: error instanceof Error ? error.message : String(error) });
    
    const response = NextResponse.json({ 
      error: "Failed to fetch conversations",
      details: error?.message 
    }, { status: 500 });
    
    return addSecurityHeaders(response);
  }
}

export async function POST(request: NextRequest) {
  try {
    let auth;
    try {
      auth = await requireApiCarrier(request);
    } catch (authError: any) {
      console.error('Auth error in carrier conversations POST:', authError);
      return NextResponse.json(
        { error: "Authentication failed", details: authError?.message || "Unauthorized" },
        { status: 401 }
      );
    }
    
    const userId = auth.userId;
    
    if (!userId) {
      console.error('No userId from auth in carrier conversations POST:', auth);
      return NextResponse.json(
        { error: "Authentication failed: no user ID" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { message, admin_user_id } = body;

    // Input validation
    const validation = validateInput({ message, admin_user_id }, {
      message: { required: true, type: 'string', minLength: 1, maxLength: 1000 },
      admin_user_id: { type: 'string', minLength: 1 }
    });

    if (!validation.valid) {
      logSecurityEvent('invalid_conversation_input', userId, { errors: validation.errors });
      return NextResponse.json({ 
        error: `Invalid input: ${validation.errors.join(', ')}` 
      }, { status: 400 });
    }

    // If no specific admin is provided, find any admin user
    let targetAdminId = admin_user_id;
    if (!targetAdminId) {
      const admins = await sql`
        SELECT supabase_user_id FROM user_roles_cache
        WHERE role = 'admin' 
        LIMIT 1
      `;
      if (admins.length > 0) {
        // Use supabase_user_id for admin
        targetAdminId = admins[0].supabase_user_id;
      } else {
        return NextResponse.json({ 
          error: "No admin users available" 
        }, { status: 400 });
      }
    }

    // Check if conversation already exists
    // Note: carrier_user_id and admin_user_id were removed in migration 078
    // Only supabase_carrier_user_id and supabase_admin_user_id exist now
    const existingConversation = await sql`
      SELECT id FROM conversations c
      WHERE c.supabase_carrier_user_id = ${userId}
      AND c.supabase_admin_user_id = ${targetAdminId}
    `;

    let conversationId;
    if (existingConversation.length > 0) {
      conversationId = existingConversation[0].id;
    } else {
      // Create new conversation (Supabase-only)
      // Only insert columns that definitely exist in the conversations table
      const conversationResult = await sql`
        INSERT INTO conversations (
          supabase_carrier_user_id,
          admin_user_id,
          conversation_type,
          created_at,
          updated_at
        ) VALUES (
          ${userId},
          ${targetAdminId}, 
          'regular', 
          CURRENT_TIMESTAMP, 
          CURRENT_TIMESTAMP
        )
        RETURNING id
      `;
      conversationId = conversationResult[0].id;
    }

    // Create the initial message
    const messageResult = await sql`
      INSERT INTO conversation_messages (
        conversation_id,
        supabase_sender_id,
        sender_type,
        message
      ) VALUES (${conversationId}, ${userId}, 'carrier', ${message})
      RETURNING id, created_at
    `;

    logSecurityEvent('conversation_created', userId, { conversationId, messageId: messageResult[0].id });
    
    const response = NextResponse.json({ 
      ok: true, 
      message: "Conversation created and message sent successfully",
      data: { 
        conversation_id: conversationId,
        message_id: messageResult[0].id,
        created_at: messageResult[0].created_at
      }
    });
    
    return addSecurityHeaders(response);

  } catch (error) {
    console.error("Error creating conversation:", error);
    logSecurityEvent('conversation_creation_error', undefined, { error: error instanceof Error ? error.message : String(error) });
    
    const response = NextResponse.json({ 
      error: "Failed to create conversation" 
    }, { status: 500 });
    
    return addSecurityHeaders(response);
  }
}
