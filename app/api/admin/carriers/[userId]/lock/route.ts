import { requireApiAdmin } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    // Ensure user is admin (Supabase-only)
    const auth = await requireApiAdmin(request);
    const adminUserId = auth.userId;

    const { userId: carrierUserId } = await params;
    const body = await request.json();
    const { reason } = body;

    // Lock carrier profile (Supabase-only)
    await sql`
      UPDATE carrier_profiles SET
        is_locked = true,
        locked_at = CURRENT_TIMESTAMP,
        locked_by = ${adminUserId},
        lock_reason = ${reason}
      WHERE supabase_user_id = ${carrierUserId}
    `;

    return NextResponse.json({ 
      ok: true, 
      message: "Profile locked successfully" 
    });

  } catch (error) {
    console.error("Error locking carrier profile:", error);
    return NextResponse.json({ 
      error: "Failed to lock profile" 
    }, { status: 500 });
  }
}
