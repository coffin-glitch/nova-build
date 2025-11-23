import { addSecurityHeaders, logSecurityEvent } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { NextRequest, NextResponse } from "next/server";
import sql from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    // Check rate limit for public route (IP-based)
    const rateLimit = await checkApiRateLimit(request, {
      routeType: 'public'
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
    // Use parameterized query instead of sql.unsafe to prevent SQL injection
    const rows = await sql`
      SELECT id, bid_code, distance_miles, message_posted_at, expires_at, is_usps, tags
      FROM public.bids
      WHERE status = 'ACTIVE' AND expires_at > NOW()
      ORDER BY message_posted_at DESC
      LIMIT 200
    `;
    
    const response = NextResponse.json({ bids: rows });
    return addRateLimitHeaders(addSecurityHeaders(response), rateLimit);
    
  } catch (error: any) {
    console.error("Error fetching active bids:", error);
    
    logSecurityEvent('active_bids_fetch_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        bids: [],
        error: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : "Failed to fetch active bids"
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}
