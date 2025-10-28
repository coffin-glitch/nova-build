import { getClerkUserRole } from '@/lib/clerk-server';
import sql from '@/lib/db';
import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bidNumber: string }> }
) {
  try {
    const { bidNumber } = await params;
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = await getClerkUserRole(userId);
    if (userRole !== "admin" && userRole !== "carrier") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // For carriers: verify they own this bid
    if (userRole === "carrier") {
      const ownership = await sql`
        SELECT 1 FROM auction_awards 
        WHERE bid_number = ${bidNumber} AND winner_user_id = ${userId}
        LIMIT 1
      `;
      
      if (ownership.length === 0) {
        return NextResponse.json(
          { error: "You don't have access to this bid" },
          { status: 403 }
        );
      }
    }

    // Get messages for this bid
    // For carriers: exclude internal messages
    // For admins: show all messages including internal
    const messages = await sql`
      SELECT 
        bm.*,
        CASE 
          WHEN bm.sender_role = 'admin' THEN (
            SELECT (first_name || ' ' || last_name)::text 
            FROM users 
            WHERE clerk_user_id = bm.sender_id
            LIMIT 1
          )
          ELSE (
            SELECT COALESCE(contact_name, company_name, 'Carrier') 
            FROM carrier_profiles 
            WHERE clerk_user_id = bm.sender_id
            LIMIT 1
          )
        END as sender_name
      FROM bid_messages bm
      WHERE bm.bid_number = ${bidNumber}
        ${userRole === 'carrier' ? sql`AND (bm.is_internal = false OR bm.is_internal IS NULL)` : sql``}
      ORDER BY bm.created_at ASC
    `;

    // Get unread count for current user
    const unreadCount = await sql`
      SELECT COUNT(*) as unread_count
      FROM bid_messages
      WHERE bid_number = ${bidNumber}
        AND sender_id != ${userId}
        AND read_at IS NULL
    `;

    return NextResponse.json({
      ok: true,
      data: {
        messages: messages || [],
        unreadCount: unreadCount[0]?.unread_count || 0
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
  try {
    const { bidNumber } = await params;
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = await getClerkUserRole(userId);
    if (userRole !== "admin" && userRole !== "carrier") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const { message, is_internal = false } = await request.json();

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

    // For carriers: verify they own this bid
    if (userRole === "carrier") {
      const ownership = await sql`
        SELECT 1 FROM auction_awards 
        WHERE bid_number = ${bidNumber} AND winner_user_id = ${userId}
        LIMIT 1
      `;
      
      if (ownership.length === 0) {
        return NextResponse.json(
          { error: "You don't have access to this bid" },
          { status: 403 }
        );
      }
    }

    // Insert the message
    console.log('[Bid Messages] Inserting message:', { bidNumber, userId, userRole, messageLength: message.trim().length, is_internal });
    
    const result = await sql`
      INSERT INTO bid_messages (bid_number, sender_id, sender_role, message, is_internal)
      VALUES (${bidNumber}, ${userId}, ${userRole}, ${message.trim()}, ${is_internal})
      RETURNING *
    `;

    console.log('[Bid Messages] Message inserted successfully:', result[0]?.id);

    return NextResponse.json({
      ok: true,
      data: {
        message: result[0],
        message: "Message sent successfully"
      }
    });

  } catch (error) {
    console.error("Error sending bid message:", error);
    return NextResponse.json(
      { error: "Failed to send message", details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

