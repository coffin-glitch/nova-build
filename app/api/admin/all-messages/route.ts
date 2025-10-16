import { getClerkUserRole } from "@/lib/clerk-server";
import sql from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const userRole = await getClerkUserRole(userId);
    if (userRole !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get all admin messages
    const adminMessages = await sql`
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
      ORDER BY created_at DESC
    `;

    return NextResponse.json({ 
      ok: true, 
      data: adminMessages 
    });

  } catch (error) {
    console.error("Error fetching all admin messages:", error);
    return NextResponse.json({ 
      error: "Failed to fetch admin messages" 
    }, { status: 500 });
  }
}
