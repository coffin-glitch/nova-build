import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import sql from "@/lib/db.server";

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get("unread") === "1";

    let query = sql`
      SELECT 
        id,
        type,
        title,
        message,
        read,
        created_at,
        metadata
      FROM notifications
      WHERE clerk_user_id = ${userId}
    `;

    if (unreadOnly) {
      query = sql`
        SELECT 
          id,
          type,
          title,
          message,
          read,
          created_at,
          metadata
        FROM notifications
        WHERE clerk_user_id = ${userId} AND read = false
      `;
    }

    const notifications = await query;

    return NextResponse.json({
      ok: true,
      data: notifications,
    });
  } catch (error: any) {
    console.error("Notifications GET API error:", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { notification_id, mark_all_read } = body;

    if (mark_all_read) {
      // Mark all notifications as read for this user
      await sql`
        UPDATE notifications
        SET read = true, updated_at = now()
        WHERE clerk_user_id = ${userId} AND read = false
      `;

      return NextResponse.json({
        ok: true,
        message: "All notifications marked as read",
      });
    }

    if (notification_id) {
      // Mark specific notification as read
      const result = await sql`
        UPDATE notifications
        SET read = true, updated_at = now()
        WHERE id = ${notification_id} AND clerk_user_id = ${userId}
        RETURNING id
      `;

      if (result.length === 0) {
        return NextResponse.json(
          { ok: false, error: "Notification not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        ok: true,
        message: "Notification marked as read",
      });
    }

    return NextResponse.json(
      { ok: false, error: "Missing required fields" },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("Notifications PATCH API error:", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}