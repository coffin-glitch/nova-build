import sql from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get notifications for the carrier
    const notifications = await sql`
      SELECT 
        n.id,
        n.type,
        n.title,
        n.message,
        n.timestamp,
        n.read,
        n.priority,
        n.action_url,
        n.load_id
      FROM carrier_notifications n
      WHERE n.carrier_user_id = ${userId}
      ORDER BY n.timestamp DESC
      LIMIT 50
    `;

    return NextResponse.json({
      ok: true,
      data: {
        notifications: notifications.map(notification => ({
          id: notification.id,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          timestamp: notification.timestamp,
          read: notification.read,
          priority: notification.priority,
          actionUrl: notification.action_url,
          loadId: notification.load_id
        }))
      }
    });

  } catch (error) {
    console.error("Error fetching notifications:", error);
    return NextResponse.json(
      { error: "Failed to fetch notifications" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { type, title, message, priority = 'medium', loadId, actionUrl } = await request.json();

    // Create notification
    const result = await sql`
      INSERT INTO carrier_notifications (
        carrier_user_id,
        type,
        title,
        message,
        priority,
        load_id,
        action_url,
        timestamp,
        created_at
      ) VALUES (
        ${userId},
        ${type},
        ${title},
        ${message},
        ${priority},
        ${loadId ? `${loadId}::uuid` : null},
        ${actionUrl || null},
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      ) RETURNING id
    `;

    return NextResponse.json({
      ok: true,
      data: {
        notificationId: result[0].id
      }
    });

  } catch (error) {
    console.error("Error creating notification:", error);
    return NextResponse.json(
      { error: "Failed to create notification" },
      { status: 500 }
    );
  }
}
