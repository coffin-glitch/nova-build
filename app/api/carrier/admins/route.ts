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

    // Check if user is carrier using the same method as middleware
    const userRole = await getClerkUserRole(userId);
    if (userRole !== "carrier") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch admin users
    const admins = await sql`
      SELECT 
        ur.user_id,
        ur.created_at as role_created_at
      FROM user_roles ur
      WHERE ur.role = 'admin'
      ORDER BY ur.created_at DESC
    `;

    return NextResponse.json(admins || []);
  } catch (error) {
    console.error("Error fetching admins:", error);
    return NextResponse.json(
      { error: "Failed to fetch admins" },
      { status: 500 }
    );
  }
}
