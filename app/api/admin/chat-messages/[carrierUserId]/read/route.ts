import sql from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  { params }: { params: { carrierUserId: string } }
) {
  try {
    const { userId: adminUserId } = await auth();
    
    if (!adminUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // TODO: Add admin role check here

    const carrierUserId = params.carrierUserId;

    // Mark all chat messages from this carrier as read
    await sql`
      UPDATE carrier_chat_messages SET
        is_read = true,
        read_at = CURRENT_TIMESTAMP
      WHERE carrier_user_id = ${carrierUserId} AND is_read = false
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
