import sql from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  { params }: { params: { userId: string } }
) {
  try {
    const { userId: adminUserId } = await auth();
    
    if (!adminUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // TODO: Add admin role check here

    const carrierUserId = params.userId;

    // Unlock carrier profile
    await sql`
      UPDATE carrier_profiles SET
        is_locked = false,
        locked_at = NULL,
        locked_by = NULL,
        lock_reason = NULL
      WHERE clerk_user_id = ${carrierUserId}
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
