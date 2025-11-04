import { requireApiAdmin } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // Ensure user is admin (Supabase-only)
    await requireApiAdmin(request);

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
