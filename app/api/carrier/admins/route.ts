import sql from "@/lib/db";
import { requireApiCarrier } from "@/lib/auth-api-helper";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiCarrier(request);

    // Fetch admin users (Supabase-only) with display names
    const admins = await sql`
      SELECT 
        ur.supabase_user_id as user_id,
        COALESCE(ap.display_name, ap.display_email, ur.email, ur.supabase_user_id::text) as display_name,
        ur.email,
        ur.created_at as role_created_at
      FROM user_roles_cache ur
      LEFT JOIN admin_profiles ap ON ur.supabase_user_id = ap.supabase_user_id
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
