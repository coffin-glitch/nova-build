import { addRateLimitHeaders, checkApiRateLimit } from "@/lib/api-rate-limiting";
import { addSecurityHeaders, logSecurityEvent } from "@/lib/api-security";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from '@/lib/db';
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // Require admin authentication for debug archive access
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
          ok: false,
          error: 'Rate limit exceeded',
          message: `Too many requests. Please try again after ${rateLimit.retryAfter} seconds.`,
          retryAfter: rateLimit.retryAfter
        },
        { status: 429 }
      );
      return addRateLimitHeaders(addSecurityHeaders(response, request), rateLimit);
    }
    
    // Simple test to see what's in the database
    const totalCount = await sql`SELECT COUNT(*) as total FROM archived_bids`;
    const sampleData = await sql`SELECT archived_at, COUNT(*) as count FROM archived_bids GROUP BY archived_at ORDER BY archived_at DESC LIMIT 5`;
    const dateRange = await sql`SELECT MIN(archived_at) as min_date, MAX(archived_at) as max_date FROM archived_bids`;
    
    logSecurityEvent('debug_archive_accessed', userId);
    
    const response = NextResponse.json({
      ok: true,
      totalCount: totalCount[0]?.total,
      sampleData: sampleData,
      dateRange: dateRange[0]
    });
    
    return addSecurityHeaders(response, request);

  } catch (error: any) {
    console.error("Debug API error:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('debug_archive_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to fetch debug data",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response, request);
  }
}

