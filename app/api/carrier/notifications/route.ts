import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { requireApiCarrier, unauthorizedResponse } from "@/lib/auth-api-helper";
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

    // Check rate limit for read-only carrier operation
    const rateLimit = await checkApiRateLimit(request, {
      userId,
      routeType: 'readOnly'
    });

    if (!rateLimit.allowed) {
      const response = NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: `Too many requests. Please try again after ${rateLimit.retryAfter} seconds.`,
          retryAfter: rateLimit.retryAfter
        },
        { status: 429 }
      );
      return addRateLimitHeaders(addSecurityHeaders(response, request), rateLimit);
    }
    
    if (!userId) {
      console.error('No userId from auth in carrier notifications GET:', auth);
      return NextResponse.json(
        { error: "Authentication failed: no user ID" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit') || '50';
    const offsetParam = searchParams.get('offset') || '0';
    const unreadOnly = searchParams.get('unread_only') === 'true';
    const typeFilter = searchParams.get('type'); // Filter by notification type
    const groupByType = searchParams.get('group_by_type') === 'true'; // Group notifications by type

    // Input validation
    const validation = validateInput(
      { limit: limitParam, offset: offsetParam, typeFilter },
      {
        limit: { type: 'string', pattern: /^\d+$/, required: false },
        offset: { type: 'string', pattern: /^\d+$/, required: false },
        typeFilter: { type: 'string', maxLength: 50, required: false }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_notifications_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response, request);
    }

    const limit = Math.min(parseInt(limitParam), 100); // Max 100
    const offset = Math.max(0, parseInt(offsetParam)); // Ensure non-negative

    // Auto-cleanup: Mark notifications as read if older than 7 days
    await sql`
      UPDATE notifications
      SET read = true
      WHERE user_id = ${userId}
        AND read = false
        AND created_at < NOW() - INTERVAL '7 days'
    `;

    // Build WHERE clause
    let whereClause = sql`WHERE user_id = ${userId}`;
    
    // Auto-cleanup: Hide notifications older than 30 days (still in DB, just not shown)
    whereClause = sql`${whereClause} AND created_at >= NOW() - INTERVAL '30 days'`;
    
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

    // Get total count (only for notifications within 30 days)
    const countResult = await sql`
      SELECT COUNT(*) as count 
      FROM notifications 
      WHERE user_id = ${userId}
        AND created_at >= NOW() - INTERVAL '30 days'
      ${unreadOnly ? sql`AND read = false` : sql``}
    `;
    
    const totalCount = countResult[0]?.count || 0;

    logSecurityEvent('carrier_notifications_accessed', userId);
    
    const response = NextResponse.json({ 
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
    
    return addRateLimitHeaders(addSecurityHeaders(response, request), rateLimit);

  } catch (error: any) {
    console.error('Error fetching notifications:', error);
    
    // Handle authentication/authorization errors properly
    if (error.message === "Unauthorized" || error.message === "Carrier access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('carrier_notifications_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to fetch notifications",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : String(error))
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response, request);
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

    // Input validation
    const validation = validateInput(
      { id },
      {
        id: { required: true, type: 'string', minLength: 1, maxLength: 100 }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_notification_read_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response, request);
    }

    const result = await sql`
      UPDATE carrier_notifications 
      SET read = true, updated_at = NOW()
      WHERE id = ${id} AND (supabase_user_id = ${userId} OR carrier_user_id = ${userId})
      RETURNING id
    `;

    if (result.length === 0) {
      logSecurityEvent('notification_not_found', userId, { notification_id: id });
      const response = NextResponse.json(
        { error: "Notification not found" },
        { status: 404 }
      );
      return addSecurityHeaders(response, request);
    }

    logSecurityEvent('notification_marked_read', userId, { notification_id: id });
    
    const response = NextResponse.json({ 
      ok: true, 
      message: "Notification marked as read" 
    });
    
    return addSecurityHeaders(response, request);

  } catch (error: any) {
    console.error('Error marking notification as read:', error);
    
    if (error.message === "Unauthorized" || error.message === "Carrier access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('notification_read_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to mark notification as read",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response, request);
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

    // Input validation
    const validation = validateInput(
      { id },
      {
        id: { required: true, type: 'string', minLength: 1, maxLength: 100 }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_notification_delete_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response, request);
    }

    const result = await sql`
      DELETE FROM carrier_notifications 
      WHERE id = ${id} AND (supabase_user_id = ${userId} OR carrier_user_id = ${userId})
      RETURNING id
    `;

    if (result.length === 0) {
      logSecurityEvent('notification_delete_not_found', userId, { notification_id: id });
      const response = NextResponse.json(
        { error: "Notification not found" },
        { status: 404 }
      );
      return addSecurityHeaders(response, request);
    }

    logSecurityEvent('notification_deleted', userId, { notification_id: id });
    
    const response = NextResponse.json({ 
      ok: true, 
      message: "Notification deleted" 
    });
    
    return addSecurityHeaders(response, request);

  } catch (error: any) {
    console.error('Error deleting notification:', error);
    
    if (error.message === "Unauthorized" || error.message === "Carrier access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('notification_delete_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to delete notification",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response, request);
  }
}