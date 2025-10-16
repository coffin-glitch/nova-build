import sql from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: { notificationId: string } }
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { notificationId } = params;

    // Mark notification as read
    const result = await sql`
      UPDATE carrier_notifications 
      SET read = true, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${notificationId} AND carrier_user_id = ${userId}
      RETURNING id
    `;

    if (result.length === 0) {
      return NextResponse.json({ error: "Notification not found" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      data: { notificationId }
    });

  } catch (error) {
    console.error("Error marking notification as read:", error);
    return NextResponse.json(
      { error: "Failed to mark notification as read" },
      { status: 500 }
    );
  }
}
