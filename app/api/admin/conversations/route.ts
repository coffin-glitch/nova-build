import { forbiddenResponse, requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // Supabase auth only
    const auth = await requireApiAdmin(request);
    const userId = auth.userId;

    // Get conversations for the current admin with unread counts
    // Includes both admin-to-carrier and admin-to-admin conversations
    // For admin-to-admin: current user can be in supabase_admin_user_id OR supabase_carrier_user_id
    const conversations = await sql`
      SELECT 
        c.id as conversation_id,
        COALESCE(c.supabase_carrier_user_id, c.supabase_admin_user_id) as other_user_id,
        c.supabase_carrier_user_id as carrier_user_id,
        c.supabase_admin_user_id,
        c.last_message_at,
        c.created_at,
        c.updated_at,
        COALESCE(COUNT(CASE WHEN mr.id IS NULL AND (
          (cm.sender_type = 'carrier' AND c.supabase_admin_user_id = ${userId}) OR
          (cm.sender_type = 'admin' AND c.supabase_carrier_user_id = ${userId})
        ) THEN 1 END)::integer, 0) as unread_count,
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
        ) as last_message_sender_type,
        (
          SELECT cm2.created_at 
          FROM conversation_messages cm2 
          WHERE cm2.conversation_id = c.id 
          ORDER BY cm2.created_at DESC 
          LIMIT 1
        ) as last_message_timestamp,
        CASE 
          WHEN c.supabase_admin_user_id = ${userId} AND c.supabase_carrier_user_id IS NOT NULL THEN 'carrier'
          WHEN c.supabase_carrier_user_id = ${userId} THEN 'admin'
          ELSE 'carrier'
        END as conversation_with_type
      FROM conversations c
      LEFT JOIN conversation_messages cm ON cm.conversation_id = c.id
      LEFT JOIN message_reads mr ON mr.message_id = cm.id AND mr.supabase_user_id = ${userId}
      WHERE c.supabase_admin_user_id = ${userId}
         OR (c.supabase_carrier_user_id = ${userId} AND EXISTS (
           SELECT 1 FROM user_roles_cache ur 
           WHERE ur.supabase_user_id = c.supabase_admin_user_id 
           AND ur.role = 'admin'
         ))
      GROUP BY c.id, c.supabase_carrier_user_id, c.supabase_admin_user_id, c.last_message_at, c.created_at, c.updated_at
      ORDER BY c.last_message_at DESC NULLS LAST, c.created_at DESC
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
    const { user_id, carrier_user_id, admin_user_id } = body;
    
    // Support both user_id (for any user) and carrier_user_id/admin_user_id (for backward compatibility)
    const targetUserId = user_id || carrier_user_id || admin_user_id;

    if (!targetUserId) {
      return NextResponse.json({ 
        error: "Missing required field: user_id, carrier_user_id, or admin_user_id" 
      }, { status: 400 });
    }

    // Check if target user is an admin or carrier
    const targetUserRole = await sql`
      SELECT role FROM user_roles_cache 
      WHERE supabase_user_id = ${targetUserId}
      LIMIT 1
    `;
    
    const isTargetAdmin = targetUserRole[0]?.role === 'admin';
    
    // Check if conversation already exists (Supabase-only)
    // For admin-to-carrier: current user is admin, target is carrier
    // For admin-to-admin: current user is admin, target can be in carrier_user_id field
    let existingConversation;
    if (isTargetAdmin) {
      // Admin-to-admin: check both directions
      existingConversation = await sql`
        SELECT id FROM conversations 
        WHERE (
          (supabase_admin_user_id = ${userId} AND supabase_carrier_user_id = ${targetUserId})
          OR
          (supabase_admin_user_id = ${targetUserId} AND supabase_carrier_user_id = ${userId})
        )
        AND EXISTS (
          SELECT 1 FROM user_roles_cache ur1 
          WHERE ur1.supabase_user_id = ${userId} AND ur1.role = 'admin'
        )
        AND EXISTS (
          SELECT 1 FROM user_roles_cache ur2 
          WHERE ur2.supabase_user_id = ${targetUserId} AND ur2.role = 'admin'
        )
        LIMIT 1
      `;
    } else {
      // Admin-to-carrier: current user is admin, target is carrier
      existingConversation = await sql`
        SELECT id FROM conversations 
        WHERE supabase_carrier_user_id = ${targetUserId}
          AND supabase_admin_user_id = ${userId}
        LIMIT 1
      `;
    }

    if (existingConversation.length > 0) {
      return NextResponse.json({ 
        ok: true, 
        conversation_id: existingConversation[0].id,
        message: "Conversation already exists"
      });
    }

    // Create new conversation (Supabase-only)
    // For admin-to-admin: store target admin in supabase_carrier_user_id (even though they're an admin)
    // For admin-to-carrier: store target carrier in supabase_carrier_user_id
    let result;
    try {
      result = await sql`
        INSERT INTO conversations (
          supabase_carrier_user_id,
          supabase_admin_user_id,
          subject,
          status,
          conversation_type,
          created_at,
          updated_at
        ) VALUES (
          ${targetUserId}, 
          ${userId},
          ${isTargetAdmin ? 'Admin Chat' : 'Admin Chat'}, 
          'active', 
          'regular', 
          CURRENT_TIMESTAMP, 
          CURRENT_TIMESTAMP
        )
        RETURNING id
      `;
    } catch (insertError: any) {
      // If subject/status columns don't exist, try without them
      if (insertError?.code === '42703' || insertError?.message?.includes('column') || insertError?.message?.includes('does not exist')) {
        result = await sql`
          INSERT INTO conversations (
            supabase_carrier_user_id,
            supabase_admin_user_id,
            conversation_type,
            created_at,
            updated_at
          ) VALUES (
            ${targetUserId}, 
            ${userId},
            'regular', 
            CURRENT_TIMESTAMP, 
            CURRENT_TIMESTAMP
          )
          RETURNING id
        `;
      } else {
        throw insertError;
      }
    }

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