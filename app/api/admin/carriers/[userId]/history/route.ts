import { getClerkUserRole } from "@/lib/clerk-server";
import sql from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const { userId: adminUserId } = await auth();
    
    if (!adminUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const userRole = await getClerkUserRole(adminUserId);
    if (userRole !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { userId } = params;

    // Fetch profile history for the specified carrier
    const history = await sql`
      SELECT 
        id,
        carrier_user_id,
        profile_data,
        profile_status,
        submitted_at,
        reviewed_at,
        reviewed_by,
        review_notes,
        decline_reason,
        version_number,
        created_at
      FROM carrier_profile_history
      WHERE carrier_user_id = ${userId}
      ORDER BY version_number DESC
    `;

    // Parse the JSONB profile_data for each history record
    const parsedHistory = history.map((record: any) => ({
      ...record,
      profile_data: typeof record.profile_data === 'string' 
        ? JSON.parse(record.profile_data) 
        : record.profile_data
    }));

    return NextResponse.json({ 
      ok: true, 
      data: parsedHistory || [] 
    });
  } catch (error) {
    console.error("Error fetching carrier profile history:", error);
    return NextResponse.json(
      { error: "Failed to fetch profile history" },
      { status: 500 }
    );
  }
}
