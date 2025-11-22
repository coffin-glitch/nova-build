import { addSecurityHeaders, logSecurityEvent } from "@/lib/api-security";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // Ensure user is admin (Supabase-only)
    const auth = await requireApiAdmin(request);
    const userId = auth.userId;

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

    logSecurityEvent('admin_list_accessed', userId, { adminCount: admins.length });
    
    const response = NextResponse.json(admins || []);
    return addSecurityHeaders(response);
    
  } catch (error: any) {
    console.error("Error fetching admins:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('admin_list_fetch_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to fetch admins",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}

