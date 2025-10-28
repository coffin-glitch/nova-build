import sql from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

// GET /api/carrier/notifications - Get carrier notifications
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const unreadOnly = searchParams.get('unread_only') === 'true';

    let query = sql`
      SELECT 
        id,
        type,
        title,
        message,
        bid_number,
        priority,
        read,
        timestamp,
        created_at
      FROM carrier_notifications
      WHERE carrier_user_id = ${userId}
    `;

    if (unreadOnly) {
      query = sql`
        SELECT 
          id,
          type,
          title,
          message,
          bid_number,
          priority,
          read,
          timestamp,
          created_at
        FROM carrier_notifications
        WHERE carrier_user_id = ${userId} AND read = false
      `;
    }

    query = sql`
      ${query}
      ORDER BY timestamp DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const notifications = await query;

    // Get total count
    const countQuery = unreadOnly 
      ? sql`SELECT COUNT(*) as count FROM carrier_notifications WHERE carrier_user_id = ${userId} AND read = false`
      : sql`SELECT COUNT(*) as count FROM carrier_notifications WHERE carrier_user_id = ${userId}`;
    
    const countResult = await countQuery;
    const totalCount = countResult[0]?.count || 0;

    return NextResponse.json({ 
      ok: true, 
      data: {
        notifications,
        pagination: {
          total: totalCount,
          limit,
          offset,
          hasMore: offset + limit < totalCount
        }
      }
    });

  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json(
      { error: "Failed to fetch notifications" },
      { status: 500 }
    );
  }
}

// PUT /api/carrier/notifications/[id]/read - Mark notification as read
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const result = await sql`
      UPDATE carrier_notifications 
      SET read = true, updated_at = NOW()
      WHERE id = ${id} AND carrier_user_id = ${userId}
      RETURNING id
    `;

    if (result.length === 0) {
      return NextResponse.json(
        { error: "Notification not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ 
      ok: true, 
      message: "Notification marked as read" 
    });

  } catch (error) {
    console.error('Error marking notification as read:', error);
    return NextResponse.json(
      { error: "Failed to mark notification as read" },
      { status: 500 }
    );
  }
}

// DELETE /api/carrier/notifications/[id] - Delete notification
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const result = await sql`
      DELETE FROM carrier_notifications 
      WHERE id = ${id} AND carrier_user_id = ${userId}
      RETURNING id
    `;

    if (result.length === 0) {
      return NextResponse.json(
        { error: "Notification not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ 
      ok: true, 
      message: "Notification deleted" 
    });

  } catch (error) {
    console.error('Error deleting notification:', error);
    return NextResponse.json(
      { error: "Failed to delete notification" },
      { status: 500 }
    );
  }
}