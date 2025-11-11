import { requireApiCarrier } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiCarrier(request);
    const userId = auth.userId;

    // Get appeal conversations for the current carrier with unread counts
    const conversations = await sql`
      SELECT 
        c.id as conversation_id,
        c.supabase_admin_user_id as admin_user_id,
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
      LEFT JOIN message_reads mr ON mr.message_id = cm.id AND mr.supabase_user_id = ${userId}
      WHERE c.supabase_carrier_user_id = ${userId}
      AND c.conversation_type = 'appeal'
      GROUP BY c.id, c.supabase_admin_user_id, c.last_message_at, c.created_at, c.updated_at
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

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiCarrier(request);
    const userId = auth.userId;

    const body = await request.json();
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
      WHERE supabase_carrier_user_id = ${userId} AND (supabase_admin_user_id = ${targetAdminId} OR supabase_admin_user_id IS NULL) AND conversation_type = 'appeal'
    `;

    let conversationId;
    if (existingConversation.length > 0) {
      conversationId = existingConversation[0].id;
    } else {
      // Create new appeal conversation (Supabase-only)
      // Note: For appeals, we may not have a specific admin assigned yet, so supabase_admin_user_id can be NULL
      const conversationResult = await sql`
        INSERT INTO conversations (
          supabase_carrier_user_id,
          supabase_admin_user_id,
          subject,
          status,
          conversation_type,
          created_at,
          updated_at
        ) VALUES (${userId}, ${targetAdminId !== 'admin_system' ? targetAdminId : null}, 'Profile Appeal', 'active', 'appeal', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id
      `;
      conversationId = conversationResult[0].id;
    }

    // Create the appeal message
    const messageResult = await sql`
      INSERT INTO conversation_messages (
        conversation_id,
        supabase_sender_id,
        sender_type,
        message,
        created_at,
        updated_at
      ) VALUES (
        ${conversationId}, 
        ${userId},
        'carrier', 
        ${message}, 
        CURRENT_TIMESTAMP, 
        CURRENT_TIMESTAMP
      )
      RETURNING id, created_at
    `;

    // Update conversation last_message_at
    await sql`
      UPDATE conversations
      SET last_message_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${conversationId}
    `;

    // Notify all admins about the new appeal message
    try {
      const { notifyAllAdmins, getCarrierProfileInfo } = await import('@/lib/notifications');
      
      // Get carrier profile info for the notification
      const carrierProfile = await getCarrierProfileInfo(userId);
      const carrierName = carrierProfile?.legalName || carrierProfile?.companyName || 'Unknown Carrier';
      const mcNumber = carrierProfile?.mcNumber || 'N/A';
      
      // Create message preview (first 100 chars)
      const messagePreview = message.length > 100 ? message.substring(0, 100) + '...' : message;
      
      await notifyAllAdmins(
        'appeal_message',
        '📩 New Appeal Message',
        `${carrierName} (MC: ${mcNumber}) sent an appeal message: ${messagePreview}`,
        {
          conversation_id: conversationId,
          carrier_user_id: userId,
          carrier_name: carrierName,
          mc_number: mcNumber,
          message_id: messageResult[0].id,
          message_preview: messagePreview,
          is_new_conversation: existingConversation.length === 0
        }
      );
    } catch (notificationError) {
      console.error('Failed to create admin notifications for appeal message:', notificationError);
      // Don't throw - message sending should still succeed even if notifications fail
    }

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
