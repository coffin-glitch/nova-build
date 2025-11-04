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

    // Get chat messages for specific carrier (Supabase-only)
    const chatMessages = await sql`
      SELECT 
        id,
        supabase_user_id,
        message,
        created_at,
        updated_at
      FROM carrier_chat_messages 
      WHERE supabase_user_id = ${carrierUserId}
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
