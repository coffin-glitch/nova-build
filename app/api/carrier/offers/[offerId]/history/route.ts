import sql from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Verify the offer belongs to this carrier
    const offerCheck = await sql`
      SELECT id FROM load_offers 
      WHERE id = ${id} AND carrier_user_id = ${userId}
    `;

    if (offerCheck.length === 0) {
      return NextResponse.json({ error: "Offer not found" }, { status: 404 });
    }

    // Get offer history with user information
    const history = await sql`
      SELECT 
        oh.*,
        urc.email as performed_by_email,
        urc.role as performed_by_role
      FROM offer_history oh
      LEFT JOIN user_roles_cache urc ON oh.performed_by = urc.clerk_user_id
      WHERE oh.offer_id = ${id}
      ORDER BY oh.performed_at DESC
    `;

    return NextResponse.json({
      ok: true,
      history: history
    });

  } catch (error) {
    console.error("Error fetching carrier offer history:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
