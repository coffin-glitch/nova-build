import { requireApiAdmin, requireApiCarrier } from '@/lib/auth-api-helper';
import sql from '@/lib/db';
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bidNumber: string }> }
) {
  try {
    const { bidNumber } = await params;
    
    // Check if user is admin or carrier
    let userId: string;
    let userRole: 'admin' | 'carrier';
    
    try {
      const adminAuth = await requireApiAdmin(request);
      userId = adminAuth.userId;
      userRole = 'admin';
    } catch {
      // Not admin, try carrier
      const carrierAuth = await requireApiCarrier(request);
      userId = carrierAuth.userId;
      userRole = 'carrier';
    }
    
    console.log('[Bid Messages API] User:', userId, 'Role:', userRole);

    // For carriers: verify they own this bid (Supabase-only)
    // Note: winner_user_id was removed in migration 078, only supabase_winner_user_id exists
    if (userRole === "carrier") {
      const ownership = await sql`
        SELECT 1 FROM auction_awards 
        WHERE bid_number = ${bidNumber} AND supabase_winner_user_id = ${userId}
        LIMIT 1
      `;
      
      if (ownership.length === 0) {
        return NextResponse.json(
          { error: "You don't have access to this bid" },
          { status: 403 }
        );
      }
    }

    // Get messages for this bid (Supabase-only)
    // For carriers: exclude internal messages
    // For admins: show all messages including internal
    // Note: Load all messages for now (pagination will be handled on client)
    console.log('[Bid Messages API] Fetching messages for bid:', bidNumber, 'Role:', userRole, 'Filter internal:', userRole === 'carrier');
    
    const messages = await sql`
      SELECT 
        bm.*,
        COALESCE(bm.is_internal, false) as is_internal,
        CASE 
          WHEN bm.sender_role = 'admin' THEN (
            SELECT COALESCE(ap.display_name, ap.display_email, urc.email, 'Admin')
            FROM user_roles_cache urc
            LEFT JOIN admin_profiles ap ON urc.supabase_user_id = ap.supabase_user_id
            WHERE urc.supabase_user_id = bm.supabase_sender_id
            LIMIT 1
          )
          ELSE (
            SELECT COALESCE(contact_name, company_name, legal_name, 'Carrier') 
            FROM carrier_profiles 
            WHERE supabase_user_id = bm.supabase_sender_id
            LIMIT 1
          )
        END as sender_name
      FROM bid_messages bm
      WHERE bm.bid_number = ${bidNumber}
        ${userRole === 'carrier' ? sql`AND COALESCE(bm.is_internal, false) = false` : sql``}
      ORDER BY bm.created_at ASC
    `;

    console.log('[Bid Messages API] Total messages retrieved:', messages.length);
    const internalCount = messages.filter((m: any) => m.is_internal).length;
    console.log('[Bid Messages API] Internal messages in result:', internalCount);

    // Get unread count for current user (Supabase-only)
    // Note: sender_id was removed in migration 078, only supabase_sender_id exists
    const unreadCount = await sql`
      SELECT COUNT(*) as unread_count
      FROM bid_messages
      WHERE bid_number = ${bidNumber}
        AND supabase_sender_id != ${userId}
        AND read_at IS NULL
    `;

    return NextResponse.json({
      ok: true,
      data: {
        messages: messages || [],
        unreadCount: unreadCount[0]?.unread_count || 0,
        totalCount: messages.length
      }
    });

  } catch (error) {
    console.error("Error fetching bid messages:", error);
    return NextResponse.json(
      { error: "Failed to fetch messages", details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ bidNumber: string }> }
) {
  let bidNumber: string | undefined;
  let userId: string | undefined;
  let userRole: 'admin' | 'carrier' | undefined;
  let is_internal: boolean | undefined;
  
  try {
    const paramsResult = await params;
    bidNumber = paramsResult.bidNumber;
    
    // Check if user is admin or carrier (Supabase-only)
    
    try {
      const adminAuth = await requireApiAdmin(request);
      userId = adminAuth.userId;
      userRole = 'admin';
    } catch {
      // Not admin, try carrier
      const carrierAuth = await requireApiCarrier(request);
      userId = carrierAuth.userId;
      userRole = 'carrier';
    }

    const { message, is_internal: isInternal = false } = await request.json();
    is_internal = isInternal;

    if (!message || !message.trim()) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // Only admins can send internal messages
    if (is_internal && userRole !== "admin") {
      return NextResponse.json(
        { error: "Only admins can send internal messages" },
        { status: 403 }
      );
    }

    // For carriers: verify they own this bid (Supabase-only)
    // Note: winner_user_id was removed in migration 078, only supabase_winner_user_id exists
    if (userRole === "carrier") {
      const ownership = await sql`
        SELECT 1 FROM auction_awards 
        WHERE bid_number = ${bidNumber} AND supabase_winner_user_id = ${userId}
        LIMIT 1
      `;
      
      if (ownership.length === 0) {
        return NextResponse.json(
          { error: "You don't have access to this bid" },
          { status: 403 }
        );
      }
    }

    // Insert the message with is_internal column (Supabase-only)
    // Note: sender_id was removed in migration 078, only supabase_sender_id exists
    console.log('[Bid Messages] Inserting message:', { bidNumber, userId, userRole, messageLength: message.trim().length, is_internal });
    
    let result;
    try {
      // Try with is_internal column and supabase_sender_id only
      result = await sql`
        INSERT INTO bid_messages (bid_number, supabase_sender_id, sender_role, message, is_internal)
        VALUES (${bidNumber!}, ${userId!}, ${userRole!}, ${message.trim()}, ${is_internal!})
        RETURNING *
      `;
    } catch (error: any) {
      console.error('[Bid Messages] Insert error:', error?.code, error?.message);
      
      // If is_internal column doesn't exist, add it and try again
      if (error?.code === '42703' && error?.message?.includes('is_internal')) {
        console.log('[Bid Messages] Adding is_internal column...');
        await sql`ALTER TABLE bid_messages ADD COLUMN IF NOT EXISTS is_internal BOOLEAN DEFAULT false`;
        
        // Try again with supabase_sender_id only
        result = await sql`
          INSERT INTO bid_messages (bid_number, supabase_sender_id, sender_role, message, is_internal)
          VALUES (${bidNumber!}, ${userId!}, ${userRole!}, ${message.trim()}, ${is_internal!})
          RETURNING *
        `;
      } 
      // If sender_id column still exists (NOT NULL constraint), try with both columns
      else if (error?.code === '23502' || (error?.code === '42703' && error?.message?.includes('sender_id'))) {
        console.log('[Bid Messages] sender_id column still exists, using both columns...');
        try {
          result = await sql`
            INSERT INTO bid_messages (bid_number, supabase_sender_id, sender_id, sender_role, message, is_internal)
            VALUES (${bidNumber!}, ${userId!}, ${userId!}, ${userRole!}, ${message.trim()}, ${is_internal!})
            RETURNING *
          `;
        } catch (innerError: any) {
          // If is_internal doesn't exist, add it first
          if (innerError?.code === '42703' && innerError?.message?.includes('is_internal')) {
            await sql`ALTER TABLE bid_messages ADD COLUMN IF NOT EXISTS is_internal BOOLEAN DEFAULT false`;
            result = await sql`
              INSERT INTO bid_messages (bid_number, supabase_sender_id, sender_id, sender_role, message, is_internal)
              VALUES (${bidNumber!}, ${userId!}, ${userId!}, ${userRole!}, ${message.trim()}, ${is_internal!})
              RETURNING *
            `;
          } else {
            throw innerError;
          }
        }
      } else {
        throw error;
      }
    }

    console.log('[Bid Messages] Message inserted successfully:', result[0]?.id);

    // Notify admins about carrier bid messages (not internal messages)
    if (userRole === 'carrier' && !is_internal) {
      try {
        const { notifyAllAdmins, getCarrierProfileInfo } = await import('@/lib/notifications');
        
        const carrierProfile = await getCarrierProfileInfo(userId);
        const carrierName = carrierProfile?.legalName || carrierProfile?.companyName || 'Unknown Carrier';
        
        // Create message preview (first 100 chars)
        const messagePreview = message.trim().length > 100 
          ? message.trim().substring(0, 100) + '...' 
          : message.trim();
        
        await notifyAllAdmins(
          'bid_message',
          '📨 New Bid Message',
          `${carrierName} sent a message about Bid #${bidNumber}: ${messagePreview}`,
          {
            bid_number: bidNumber,
            carrier_user_id: userId,
            carrier_name: carrierName,
            message_id: result[0]?.id
          }
        );
      } catch (notificationError) {
        console.error('Failed to create admin notification for bid message:', notificationError);
        // Don't throw - message sending should still succeed
      }
    }

    return NextResponse.json({
      ok: true,
      data: {
        messageData: result[0],
        message: "Message sent successfully"
      }
    });

  } catch (error) {
    console.error("Error sending bid message:", error);
    console.error("Error stack:", error instanceof Error ? error.stack : 'No stack trace');
    console.error("Error details:", {
      bidNumber,
      userId,
      userRole,
      is_internal
    });
    
    return NextResponse.json(
      { 
        ok: false,
        error: "Failed to send message", 
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

