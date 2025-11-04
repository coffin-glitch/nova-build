import sql from "@/lib/db";
import { requireApiCarrier } from "@/lib/auth-api-helper";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const auth = await requireApiCarrier(request);
    const userId = auth.userId;

    const { messageId } = await params;

    // Mark carrier chat message as read
    await sql`
      UPDATE carrier_chat_messages SET
        is_read = true,
        read_at = CURRENT_TIMESTAMP
      WHERE id = ${messageId} AND supabase_user_id = ${userId}
    `;

    return NextResponse.json({ 
      ok: true, 
      message: "Carrier chat message marked as read" 
    });

  } catch (error) {
    console.error("Error marking carrier chat message as read:", error);
    return NextResponse.json({ 
      error: "Failed to mark carrier chat message as read" 
    }, { status: 500 });
  }
}
