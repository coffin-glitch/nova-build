import sql from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch profile history for the current user
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
    console.error("Error fetching profile history:", error);
    return NextResponse.json(
      { error: "Failed to fetch profile history" },
      { status: 500 }
    );
  }
}
