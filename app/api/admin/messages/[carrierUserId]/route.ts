import { requireApiAdmin } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ carrierUserId: string }> }
) {
  try {
    // Ensure user is admin (Supabase-only)
    await requireApiAdmin(request);

    const { carrierUserId } = await params;

    // Get messages for specific carrier (Supabase-only)
    const messages = await sql`
      SELECT 
        id,
        supabase_user_id,
        admin_user_id,
        subject,
        message,
        is_read,
        read_at,
        created_at,
        updated_at
      FROM admin_messages 
      WHERE supabase_user_id = ${carrierUserId}
      ORDER BY created_at DESC
    `;

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
