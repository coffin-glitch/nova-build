import sql from "@/lib/db";
import { requireApiAuth } from "@/lib/auth-api-helper";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // Ensure user is authenticated (Supabase-only)
    const auth = await requireApiAuth(request);
    const userId = auth.userId;

    console.log('[Notifications API] Fetching notifications for userId:', userId);
    console.log('[Notifications API] Auth result:', { userId, userRole: auth.userRole, fromHeader: auth.fromHeader });

    // Get notifications for the current user (Supabase-only)
    const notifications = await sql`
      SELECT 
        n.id::text as id,
        n.type,
        n.title,
        n.message,
        n.read,
        n.created_at,
        n.data
      FROM notifications n
      WHERE n.user_id = ${userId}
      ORDER BY n.created_at DESC
      LIMIT 50
    `;

    console.log('[Notifications API] Found notifications:', notifications.length);

    // Count unread notifications
    const unreadCount = await sql`
      SELECT COUNT(*) as count
      FROM notifications n
      WHERE n.user_id = ${userId} AND n.read = false
    `;

    console.log('[Notifications API] Unread count:', parseInt(unreadCount[0].count));

    return NextResponse.json({
      success: true,
      data: {
        notifications: notifications,
        unreadCount: parseInt(unreadCount[0].count)
      }
    });

  } catch (error) {
    console.error("Error fetching notifications:", error);
    return NextResponse.json({
      error: "Failed to fetch notifications"
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Ensure user is authenticated (Supabase-only)
    const auth = await requireApiAuth(request);
    const userId = auth.userId;

    const body = await request.json();
    
    // Check if this is a bid award notification (bulk creation)
    if (body.bidNumber && body.winnerUserId) {
      return await handleBidAwardNotifications(body);
    }
    
    // Handle individual notification creation
    const { type, title, message, data } = body;

    if (!type || !title || !message) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Create notification (Supabase-only)
    const notification = await sql`
      INSERT INTO notifications (user_id, type, title, message, data)
      VALUES (${userId}, ${type}, ${title}, ${message}, ${data ? JSON.stringify(data) : null})
      RETURNING *
    `;

    return NextResponse.json({
      success: true,
      data: notification[0]
    });

  } catch (error) {
    console.error("Error creating notification:", error);
    return NextResponse.json({
      error: "Failed to create notification"
    }, { status: 500 });
  }
}

async function handleBidAwardNotifications(body: any) {
  const { bidNumber, winnerUserId, winnerAmount, winnerName } = body;
  
  try {
    // Get all carriers who bid on this auction (Supabase-only)
    const carriers = await sql`
      SELECT DISTINCT supabase_user_id 
      FROM carrier_bids 
      WHERE bid_number = ${bidNumber}
    `;
    
    const notifications = [];
    
    for (const carrier of carriers) {
      const isWinner = carrier.supabase_user_id === winnerUserId;
      
      const notification = {
        type: isWinner ? 'bid_won' : 'bid_lost',
        title: isWinner ? '🎉 Bid Won!' : 'Bid Lost',
        message: isWinner 
          ? `Congratulations! You won Bid #${bidNumber} for $${winnerAmount}`
          : `Bid #${bidNumber} was awarded to another carrier.`,
        data: {
          bidNumber,
          winnerUserId,
          winnerAmount,
          winnerName,
          isWinner
        }
      };
      
      // Create notification for this carrier (Supabase-only)
      const result = await sql`
        INSERT INTO notifications (user_id, type, title, message, data, read)
        VALUES (${carrier.supabase_user_id}, ${notification.type}, ${notification.title}, ${notification.message}, ${JSON.stringify(notification.data)}, false)
        RETURNING *
      `;
      
      notifications.push(result[0]);
    }
    
    return NextResponse.json({
      success: true,
      data: {
        notificationsCreated: notifications.length,
        notifications
      }
    });
    
  } catch (error) {
    console.error("Error creating bid award notifications:", error);
    return NextResponse.json({
      error: "Failed to create bid award notifications"
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Ensure user is authenticated (Supabase-only)
    const auth = await requireApiAuth(request);
    const userId = auth.userId;

    const body = await request.json();
    const { notificationId, read } = body;

    if (!notificationId || typeof read !== 'boolean') {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Update notification read status (Supabase-only)
    await sql`
      UPDATE notifications 
      SET read = ${read}
      WHERE id = ${notificationId} AND user_id = ${userId}
    `;

    return NextResponse.json({
      success: true,
      message: "Notification updated"
    });

  } catch (error) {
    console.error("Error updating notification:", error);
    return NextResponse.json({
      error: "Failed to update notification"
    }, { status: 500 });
  }
}