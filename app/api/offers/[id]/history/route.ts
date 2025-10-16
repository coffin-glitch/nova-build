import { requireAdmin } from "@/lib/clerk-server";
import sql from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // This will redirect if user is not admin
    await requireAdmin();

    const { id } = await params;

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
    console.error("Error fetching offer history:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
