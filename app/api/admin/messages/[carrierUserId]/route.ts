import { db } from "@/lib/db-local";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function GET(
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

    // Get messages for specific carrier
    const messages = db.prepare(`
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
      WHERE carrier_user_id = ?
      ORDER BY created_at DESC
    `).all(carrierUserId);

    return NextResponse.json({ 
      ok: true, 
      data: messages 
    });

  } catch (error) {
    console.error("Error fetching messages:", error);
    return NextResponse.json({ 
      error: "Failed to fetch messages" 
    }, { status: 500 });
  }
}
