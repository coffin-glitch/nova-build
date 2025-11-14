import { requireApiCarrier } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// GET /api/carrier/notifications - Get carrier notifications
export async function GET(request: NextRequest) {
  try {
    let auth;
    try {
      auth = await requireApiCarrier(request);
    } catch (authError: any) {
      console.error('Auth error in carrier notifications GET:', authError);
      return NextResponse.json(
        { error: "Authentication failed", details: authError?.message || "Unauthorized" },
        { status: 401 }
      );
    }
    
    const userId = auth.userId;
    
    if (!userId) {
      console.error('No userId from auth in carrier notifications GET:', auth);
      return NextResponse.json(
        { error: "Authentication failed: no user ID" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const unreadOnly = searchParams.get('unread_only') === 'true';
    const typeFilter = searchParams.get('type'); // Filter by notification type
    const groupByType = searchParams.get('group_by_type') === 'true'; // Group notifications by type

    // Build WHERE clause
    let whereClause = sql`WHERE user_id = ${userId}`;
    if (unreadOnly) {
      whereClause = sql`${whereClause} AND read = false`;
    }
    if (typeFilter) {
      whereClause = sql`${whereClause} AND type = ${typeFilter}`;
    }

    // Get notifications from main notifications table (unified with admin notifications)
    const notifications = await sql`
      SELECT 
        id::text as id,
        type,
        title,
        message,
        read,
        created_at,
        data
      FROM notifications
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    // Get total count
    const countResult = await sql`
      SELECT COUNT(*) as count 
      FROM notifications 
      WHERE user_id = ${userId}
      ${unreadOnly ? sql`AND read = false` : sql``}
    `;
    
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

  } catch (error: any) {
    // Log full error details for debugging
    console.error('[API /api/carrier/notifications] Full error:', {
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
      error: error
    });
    console.error('Error fetching notifications:', error);
    
    // Handle authentication/authorization errors properly
    if (error instanceof Error) {
      if (error.message === "Unauthorized" || error.message.includes("Unauthorized")) {
        return NextResponse.json(
          { error: "Authentication required" },
          { status: 401 }
        );
      }
      if (error.message === "Carrier access required" || error.message.includes("Carrier access")) {
        return NextResponse.json(
          { error: "Carrier access required" },
          { status: 403 }
        );
      }
    }
    
    return NextResponse.json(
      { error: "Failed to fetch notifications", details: error?.message || String(error) },
      { status: 500 }
    );
  }
}

// PUT /api/carrier/notifications/[id]/read - Mark notification as read
export async function PUT(
  request: NextRequest
) {
  try {
    let auth;
    try {
      auth = await requireApiCarrier(request);
    } catch (authError: any) {
      console.error('Auth error in carrier notifications PUT:', authError);
      return NextResponse.json(
        { error: "Authentication failed", details: authError?.message || "Unauthorized" },
        { status: 401 }
      );
    }
    
    const userId = auth.userId;
    
    if (!userId) {
      console.error('No userId from auth in carrier notifications PUT:', auth);
      return NextResponse.json(
        { error: "Authentication failed: no user ID" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { id } = body;

    const result = await sql`
      UPDATE carrier_notifications 
      SET read = true, updated_at = NOW()
      WHERE id = ${id} AND (supabase_user_id = ${userId} OR carrier_user_id = ${userId})
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
  request: NextRequest
) {
  try {
    let auth;
    try {
      auth = await requireApiCarrier(request);
    } catch (authError: any) {
      console.error('Auth error in carrier notifications DELETE:', authError);
      return NextResponse.json(
        { error: "Authentication failed", details: authError?.message || "Unauthorized" },
        { status: 401 }
      );
    }
    
    const userId = auth.userId;
    
    if (!userId) {
      console.error('No userId from auth in carrier notifications DELETE:', auth);
      return NextResponse.json(
        { error: "Authentication failed: no user ID" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { id } = body;

    const result = await sql`
      DELETE FROM carrier_notifications 
      WHERE id = ${id} AND (supabase_user_id = ${userId} OR carrier_user_id = ${userId})
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