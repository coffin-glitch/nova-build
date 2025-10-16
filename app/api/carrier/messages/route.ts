import sql from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get messages for the current carrier
    const messages = await sql`
      SELECT 
        id,
        carrier_user_id,
        admin_user_id,
        subject,
        message,
        is_read,
        read_at,
        created_at,
        updated_at
      FROM admin_messages 
      WHERE carrier_user_id = ${userId}
      ORDER BY created_at DESC
    `;

    return NextResponse.json({ 
      ok: true, 
      data: messages 
    });

  } catch (error) {
    console.error("Error fetching carrier messages:", error);
    return NextResponse.json({ 
      error: "Failed to fetch messages" 
    }, { status: 500 });
  }
}
