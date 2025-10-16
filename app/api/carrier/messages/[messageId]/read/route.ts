import sql from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  { params }: { params: { messageId: string } }
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const messageId = params.messageId;

    // Mark message as read
    await sql`
      UPDATE admin_messages SET
        is_read = true,
        read_at = CURRENT_TIMESTAMP
      WHERE id = ${messageId} AND carrier_user_id = ${userId}
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
