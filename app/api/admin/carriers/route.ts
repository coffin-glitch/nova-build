import { getClerkUserRole } from "@/lib/clerk-server";
import sql from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const userRole = await getClerkUserRole(userId);
    if (userRole !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch carrier profiles
    const carriers = await sql`
      SELECT 
        cp.clerk_user_id as user_id,
        cp.company_name,
        cp.contact_name,
        cp.phone,
        cp.created_at,
        cp.updated_at
      FROM carrier_profiles cp
      ORDER BY cp.created_at DESC
    `;

    return NextResponse.json(carriers || []);
  } catch (error) {
    console.error("Error fetching carriers:", error);
    return NextResponse.json(
      { error: "Failed to fetch carriers" },
      { status: 500 }
    );
  }
}