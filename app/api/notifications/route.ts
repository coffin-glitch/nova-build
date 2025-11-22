import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { requireApiAuth, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
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

    logSecurityEvent('notifications_accessed', userId);
    
    const response = NextResponse.json({
      success: true,
      data: {
        notifications: notifications,
        unreadCount: parseInt(unreadCount[0].count)
      }
    });
    
    return addSecurityHeaders(response);

  } catch (error: any) {
    console.error("Error fetching notifications:", error);
    
    if (error.message === "Unauthorized") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('notifications_fetch_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to fetch notifications",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
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

    // Input validation
    const validation = validateInput(
      { type, title, message, data },
      {
        type: { required: true, type: 'string', maxLength: 50 },
        title: { required: true, type: 'string', minLength: 1, maxLength: 200 },
        message: { required: true, type: 'string', minLength: 1, maxLength: 1000 },
        data: { type: 'object', required: false }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_notification_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // Create notification (Supabase-only)
    const notification = await sql`
      INSERT INTO notifications (user_id, type, title, message, data)
      VALUES (${userId}, ${type}, ${title}, ${message}, ${data ? JSON.stringify(data) : null})
      RETURNING *
    `;

    logSecurityEvent('notification_created', userId, { type, notification_id: notification[0].id });
    
    const response = NextResponse.json({
      success: true,
      data: notification[0]
    });
    
    return addSecurityHeaders(response);

  } catch (error: any) {
    console.error("Error creating notification:", error);
    
    if (error.message === "Unauthorized") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('notification_creation_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to create notification",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
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

    // Input validation
    const validation = validateInput(
      { notificationId, read },
      {
        notificationId: { required: true, type: 'string', minLength: 1, maxLength: 100 },
        read: { required: true, type: 'boolean' }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_notification_update_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // Update notification read status (Supabase-only)
    const result = await sql`
      UPDATE notifications 
      SET read = ${read}
      WHERE id = ${notificationId} AND user_id = ${userId}
      RETURNING id
    `;

    if (result.length === 0) {
      logSecurityEvent('notification_update_not_found', userId, { notificationId });
      const response = NextResponse.json(
        { error: "Notification not found" },
        { status: 404 }
      );
      return addSecurityHeaders(response);
    }

    logSecurityEvent('notification_updated', userId, { notificationId, read });
    
    const response = NextResponse.json({
      success: true,
      message: "Notification updated"
    });
    
    return addSecurityHeaders(response);

  } catch (error: any) {
    console.error("Error updating notification:", error);
    
    if (error.message === "Unauthorized") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('notification_update_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to update notification",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}