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
    const body = await req.json();
    const { reason } = body;

    // Lock carrier profile
    await sql`
      UPDATE carrier_profiles SET
        is_locked = true,
        locked_at = CURRENT_TIMESTAMP,
        locked_by = ${adminUserId},
        lock_reason = ${reason}
      WHERE clerk_user_id = ${carrierUserId}
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
