import { addSecurityHeaders, logSecurityEvent } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from '@/lib/db';
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // Require admin authentication for archive status
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
    
    // Check if the cron job exists and is active
    const result = await sql`
      SELECT 
        jobname,
        enabled,
        schedule
      FROM cron.job
      WHERE jobname = 'end-of-day-archive'
    `;

    const job = result[0];
    const enabled = job?.enabled ?? false;

    logSecurityEvent('auto_archiving_status_accessed', userId);
    
    const response = NextResponse.json({
      ok: true,
      enabled,
      message: enabled ? 'Auto-archiving is enabled' : 'Auto-archiving is disabled'
    });
    
    return addSecurityHeaders(response, request);
    
  } catch (error: any) {
    console.error("Error fetching auto-archiving status:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('auto_archiving_status_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        ok: true, 
        enabled: false, 
        error: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : "Could not fetch status")
          : "Could not fetch status"
      },
      { status: 200 }
    );
    
    return addSecurityHeaders(response, request);
  }
}

