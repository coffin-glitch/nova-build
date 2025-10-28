import sql from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get notifications for the current user
    const notifications = await sql`
      SELECT 
        n.id,
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

    // Count unread notifications
    const unreadCount = await sql`
      SELECT COUNT(*) as count
      FROM notifications n
      WHERE n.user_id = ${userId} AND n.read = false
    `;

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

export async function POST(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    // Create notification
    const notification = await sql`
      INSERT INTO notifications (recipient_user_id, type, title, body)
      VALUES (${userId}, ${type}, ${title}, ${message})
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
    // Get all carriers who bid on this auction
    const carriers = await sql`
      SELECT DISTINCT clerk_user_id 
      FROM carrier_bids 
      WHERE bid_number = ${bidNumber}
    `;
    
    const notifications = [];
    
    for (const carrier of carriers) {
      const isWinner = carrier.clerk_user_id === winnerUserId;
      
      const notification = {
        type: isWinner ? 'bid_won' : 'bid_lost',
        title: isWinner ? '🎉 Bid Won!' : 'Bid Lost',
        message: isWinner 
          ? `Congratulations! You won Bid #${bidNumber} for $${winnerAmount}`
          : `Bid #${bidNumber} was awarded to ${winnerName} for $${winnerAmount}`,
        data: {
          bidNumber,
          winnerUserId,
          winnerAmount,
          winnerName,
          isWinner
        }
      };
      
      // Create notification for this carrier
      const result = await sql`
        INSERT INTO notifications (recipient_user_id, type, title, body)
        VALUES (${carrier.clerk_user_id}, ${notification.type}, ${notification.title}, ${notification.message})
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

export async function PUT(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { notificationId, read } = body;

    if (!notificationId || typeof read !== 'boolean') {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Update notification read status
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