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

    // Mark message as read
    await sql`
      UPDATE admin_messages SET
        is_read = true,
        read_at = CURRENT_TIMESTAMP
      WHERE id = ${messageId} AND supabase_user_id = ${userId}
    `;

    return NextResponse.json({ 
      ok: true, 
      message: "Message marked as read" 
    });

  } catch (error) {
    console.error("Error marking message as read:", error);
    return NextResponse.json({ 
      error: "Failed to mark message as read" 
    }, { status: 500 });
  }
}
