import sql from "@/lib/db";
import { requireApiCarrier } from "@/lib/auth-api-helper";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiCarrier(request);
    const userId = auth.userId;

    // Mark all notifications as read for the carrier (using main notifications table)
    await sql`
      UPDATE notifications 
      SET read = true
      WHERE user_id = ${userId} AND read = false
    `;

    return NextResponse.json({
      ok: true,
      message: "All notifications marked as read"
    });

  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    return NextResponse.json(
      { error: "Failed to mark all notifications as read" },
      { status: 500 }
    );
  }
}
