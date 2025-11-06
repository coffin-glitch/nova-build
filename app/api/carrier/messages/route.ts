import sql from "@/lib/db";
import { requireApiCarrier } from "@/lib/auth-api-helper";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiCarrier(request);
    const userId = auth.userId;

    // Check carrier profile status
    const profile = await sql`
      SELECT profile_status FROM carrier_profiles 
      WHERE supabase_user_id = ${userId}
    `;

    const profileStatus = profile[0]?.profile_status;

    // Get messages for the current carrier
    let messages;
    
    if (profileStatus === 'approved') {
      // For approved carriers, only show regular admin messages (not appeal messages)
      messages = await sql`
        SELECT 
          am.id,
          am.supabase_carrier_user_id as carrier_user_id,
          am.supabase_admin_user_id as admin_user_id,
          COALESCE(ap.display_name, ap.display_email, ur.email, am.supabase_admin_user_id::text) as admin_display_name,
          am.subject,
          am.message,
          am.is_read,
          am.read_at,
          am.created_at,
          am.updated_at
        FROM admin_messages am
        LEFT JOIN user_roles_cache ur ON am.supabase_admin_user_id = ur.supabase_user_id
        LEFT JOIN admin_profiles ap ON am.supabase_admin_user_id = ap.supabase_user_id
        WHERE am.supabase_carrier_user_id = ${userId}
        ORDER BY am.created_at DESC
      `;
    } else {
      // For non-approved carriers, show all messages including appeal messages
      // This includes both admin_messages and appeal conversations converted to admin_messages format
      const adminMessages = await sql`
        SELECT 
          am.id,
          am.supabase_carrier_user_id as carrier_user_id,
          am.supabase_admin_user_id as admin_user_id,
          COALESCE(ap.display_name, ap.display_email, ur.email, am.supabase_admin_user_id::text) as admin_display_name,
          am.subject,
          am.message,
          am.is_read,
          am.read_at,
          am.created_at,
          am.updated_at
        FROM admin_messages am
        LEFT JOIN user_roles_cache ur ON am.supabase_admin_user_id = ur.supabase_user_id
        LEFT JOIN admin_profiles ap ON am.supabase_admin_user_id = ap.supabase_user_id
        WHERE am.supabase_carrier_user_id = ${userId}
        ORDER BY am.created_at DESC
      `;

      // Get appeal conversations and convert them to admin_messages format
      const appealConversations = await sql`
        SELECT 
          c.id as conversation_id,
          c.supabase_admin_user_id as admin_user_id,
          COALESCE(ap.display_name, ap.display_email, ur.email, c.supabase_admin_user_id::text) as admin_display_name,
          c.supabase_carrier_user_id as carrier_user_id,
          cm.message,
          cm.created_at,
          cm.id as message_id,
          CASE WHEN mr.id IS NULL THEN false ELSE true END as is_read,
          mr.created_at as read_at,
          cm.created_at as updated_at
        FROM conversations c
        JOIN conversation_messages cm ON cm.conversation_id = c.id
        LEFT JOIN user_roles_cache ur ON c.supabase_admin_user_id = ur.supabase_user_id
        LEFT JOIN admin_profiles ap ON c.supabase_admin_user_id = ap.supabase_user_id
        LEFT JOIN message_reads mr ON mr.message_id = cm.id AND (mr.supabase_user_id = ${userId} OR mr.user_id = ${userId})
        WHERE c.supabase_carrier_user_id = ${userId}
          AND c.conversation_type = 'appeal'
          AND cm.sender_type = 'admin'
        ORDER BY cm.created_at DESC
      `;

      // Convert appeal conversations to admin_messages format
      const appealMessages = appealConversations.map(conv => ({
        id: conv.message_id,
        carrier_user_id: conv.carrier_user_id,
        admin_user_id: conv.admin_user_id,
        admin_display_name: conv.admin_display_name,
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
