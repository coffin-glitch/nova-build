import sql from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ carrierUserId: string }> }
) {
  try {
    const { userId: adminUserId } = await auth();
    
    if (!adminUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // TODO: Add admin role check here

    const { carrierUserId } = await params;

    // Get chat messages for specific carrier
    const chatMessages = await sql`
      SELECT 
        id,
        carrier_user_id,
        message,
        created_at,
        updated_at
      FROM carrier_chat_messages 
      WHERE carrier_user_id = ${carrierUserId}
      ORDER BY created_at ASC
    `;

    return NextResponse.json({ 
      ok: true, 
      data: chatMessages 
    });

  } catch (error) {
    console.error("Error fetching carrier chat messages:", error);
    return NextResponse.json({ 
      error: "Failed to fetch chat messages" 
    }, { status: 500 });
  }
}
