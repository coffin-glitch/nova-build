import { requireApiAdmin } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // Ensure user is admin (Supabase-only)
    await requireApiAdmin(request);

    // Fetch all admin users (excluding current user)
    const admins = await sql`
      SELECT 
        ur.supabase_user_id as user_id,
        ur.email,
        ur.created_at as role_created_at
      FROM user_roles_cache ur
      WHERE ur.role = 'admin'
        AND ur.supabase_user_id IS NOT NULL
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

