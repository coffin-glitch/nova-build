import { requireApiAuth } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/announcements/[id]/read
 * Mark an announcement as read for the current carrier
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireApiAuth(request);
    const userId = auth.userId;
    const announcementId = params.id;

    // Check if announcement exists and is active
    const [announcement] = await sql`
      SELECT id, is_active, expires_at
      FROM announcements
      WHERE id = ${announcementId}::uuid
    `;

    if (!announcement) {
      return NextResponse.json({ error: "Announcement not found" }, { status: 404 });
    }

    if (!announcement.is_active) {
      return NextResponse.json({ error: "Announcement is not active" }, { status: 400 });
    }

    // Mark as read (upsert to handle duplicates)
    await sql`
      INSERT INTO announcement_reads (announcement_id, carrier_user_id, read_at)
      VALUES (${announcementId}::uuid, ${userId}, NOW())
      ON CONFLICT (announcement_id, carrier_user_id)
      DO UPDATE SET read_at = NOW()
    `;

    // Also mark the corresponding notification as read
    await sql`
      UPDATE notifications
      SET read = true
      WHERE user_id = ${userId}
        AND type = 'announcement'
        AND data->>'announcementId' = ${announcementId}
    `;

    return NextResponse.json({
      success: true,
      message: "Announcement marked as read",
    });

  } catch (error) {
    console.error("Error marking announcement as read:", error);
    return NextResponse.json({
      error: "Failed to mark announcement as read"
    }, { status: 500 });
  }
}

