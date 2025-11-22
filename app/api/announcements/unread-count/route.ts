import sql from "@/lib/db";
import { requireApiAuth } from "@/lib/auth-api-helper";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/announcements/unread-count
 * Get unread announcements count for the current user
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiAuth(request);
    const userId = auth.userId;

    const unreadCount = await sql`
      SELECT COUNT(*) as count
      FROM announcements a
      LEFT JOIN announcement_reads ar ON a.id = ar.announcement_id AND ar.carrier_user_id = ${userId}
      WHERE a.is_active = true
        AND (a.expires_at IS NULL OR a.expires_at > NOW())
        AND ar.id IS NULL
    `;

    return NextResponse.json({
      success: true,
      unreadCount: parseInt(unreadCount[0].count),
    });

  } catch (error) {
    console.error("Error fetching unread count:", error);
    return NextResponse.json({
      error: "Failed to fetch unread count"
    }, { status: 500 });
  }
}

