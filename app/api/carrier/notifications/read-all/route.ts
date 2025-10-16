import sql from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Mark all notifications as read for the carrier
    const result = await sql`
      UPDATE carrier_notifications 
      SET read = true, updated_at = CURRENT_TIMESTAMP
      WHERE carrier_user_id = ${userId} AND read = false
      RETURNING COUNT(*) as updated_count
    `;

    return NextResponse.json({
      ok: true,
      data: {
        updatedCount: result[0]?.updated_count || 0
      }
    });

  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    return NextResponse.json(
      { error: "Failed to mark all notifications as read" },
      { status: 500 }
    );
  }
}
