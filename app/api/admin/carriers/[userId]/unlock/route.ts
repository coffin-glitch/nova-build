import { requireApiAdmin } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    // Ensure user is admin (Supabase-only)
    await requireApiAdmin(request);

    const { userId: carrierUserId } = await params;

    // Unlock carrier profile (Supabase-only)
    await sql`
      UPDATE carrier_profiles SET
        is_locked = false,
        locked_at = NULL,
        locked_by = NULL,
        lock_reason = NULL
      WHERE supabase_user_id = ${carrierUserId}
    `;

    return NextResponse.json({ 
      ok: true, 
      message: "Profile unlocked successfully" 
    });

  } catch (error) {
    console.error("Error unlocking carrier profile:", error);
    return NextResponse.json({ 
      error: "Failed to unlock profile" 
    }, { status: 500 });
  }
}
