import sql from "@/lib/db";
import { requireApiCarrier } from "@/lib/auth-api-helper";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    // Ensure user is authenticated (Supabase-only)
    const auth = await requireApiCarrier(request);
    const userId = auth.userId;

    // Delete all notifications for this carrier
    await sql`
      DELETE FROM notifications 
      WHERE user_id = ${userId}
    `;

    return NextResponse.json({
      success: true,
      message: "All notifications cleared"
    });

  } catch (error) {
    console.error("Error clearing carrier notifications:", error);
    return NextResponse.json({
      error: "Failed to clear notifications"
    }, { status: 500 });
  }
}

