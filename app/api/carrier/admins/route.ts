import { addSecurityHeaders, logSecurityEvent } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { requireApiCarrier, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiCarrier(request);

    // Check rate limit for authenticated read operation
    const rateLimit = await checkApiRateLimit(request, {
      userId: auth.userId,
      routeType: 'readOnly'
    });

    if (!rateLimit.allowed) {
      const response = NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: `Too many requests. Please try again after ${rateLimit.retryAfter} seconds.`,
          retryAfter: rateLimit.retryAfter
        },
        { status: 429 }
      );
      return addRateLimitHeaders(addSecurityHeaders(response), rateLimit);
    }

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

    logSecurityEvent('carrier_admins_list_accessed', auth.userId);
    
    const response = NextResponse.json(admins || []);
    return addSecurityHeaders(response);
    
  } catch (error: any) {
    console.error("Error fetching admins:", error);
    
    if (error.message === "Unauthorized" || error.message === "Carrier access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('carrier_admins_fetch_error', undefined, { 
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
