import { addSecurityHeaders, logSecurityEvent } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/announcements/carriers
 * Get list of all approved carriers for announcement targeting
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiAdmin(request);
    const userId = auth.userId;

    // Check rate limit for admin read operation
    const rateLimit = await checkApiRateLimit(request, {
      userId,
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

    // Get all approved carriers with their emails
    const carriers = await sql`
      SELECT 
        cp.supabase_user_id,
        cp.company_name,
        cp.legal_name,
        cp.contact_name,
        urc.email
      FROM carrier_profiles cp
      LEFT JOIN user_roles_cache urc ON cp.supabase_user_id = urc.supabase_user_id
      WHERE cp.supabase_user_id IS NOT NULL
        AND cp.profile_status = 'approved'
      ORDER BY COALESCE(cp.company_name, cp.legal_name, cp.contact_name, urc.email) ASC
    `;

    // Get emails from Supabase Auth for carriers without email in cache
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    let supabase: any = null;
    
    if (supabaseUrl && supabaseKey) {
      const { createClient } = await import('@supabase/supabase-js');
      supabase = createClient(supabaseUrl, supabaseKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
    }

    const carriersWithEmails = await Promise.all(
      carriers.map(async (carrier: any) => {
        let email = carrier.email;
        
        if (!email && supabase) {
          try {
            const { data: { user } } = await supabase.auth.admin.getUserById(carrier.supabase_user_id);
            email = user?.email || null;
          } catch (error) {
            console.error(`[Announcements] Error fetching email for ${carrier.supabase_user_id}:`, error);
          }
        }

        return {
          userId: carrier.supabase_user_id,
          companyName: carrier.company_name || carrier.legal_name || 'N/A',
          contactName: carrier.contact_name || null,
          email: email || 'No email',
        };
      })
    );

    logSecurityEvent('announcement_carriers_list_accessed', userId);
    
    const response = NextResponse.json({
      success: true,
      data: carriersWithEmails,
    });
    
    return addSecurityHeaders(response);

  } catch (error: any) {
    console.error("Error fetching carriers for announcements:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('announcement_carriers_fetch_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to fetch carriers",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}

