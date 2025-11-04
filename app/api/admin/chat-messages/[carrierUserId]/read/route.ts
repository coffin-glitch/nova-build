import { requireApiAdmin } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: { carrierUserId: string } }
) {
  try {
    // Ensure user is admin (Supabase-only)
    await requireApiAdmin(request);

    const carrierUserId = params.carrierUserId;

    // Mark all chat messages from this carrier as read (Supabase-only)
    await sql`
      UPDATE carrier_chat_messages SET
        is_read = true,
        read_at = CURRENT_TIMESTAMP
      WHERE supabase_user_id = ${carrierUserId} AND is_read = false
    `;

    return NextResponse.json({ 
      ok: true, 
      message: "Messages marked as read" 
    });

  } catch (error) {
    console.error("Error marking chat messages as read:", error);
    return NextResponse.json({ 
      error: "Failed to mark messages as read" 
    }, { status: 500 });
  }
}
