import { addSecurityHeaders, logSecurityEvent } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // Check rate limit for public read operation (health checks should be generous)
    const rateLimit = await checkApiRateLimit(request, {
      routeType: 'public'
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

    // Test database connection with a simple query
    const result = await sql`SELECT 1 as ok`;
    
    if (result && result.length > 0 && result[0].ok === 1) {
      logSecurityEvent('health_check_db_accessed', undefined);
      const response = NextResponse.json({ ok: true, timestamp: new Date().toISOString() });
      return addRateLimitHeaders(addSecurityHeaders(response, request), rateLimit);
    } else {
      logSecurityEvent('health_check_db_unexpected_result', undefined);
      const response = NextResponse.json(
        { ok: false, error: "Unexpected query result" },
        { status: 500 }
      );
      return addSecurityHeaders(response, request);
    }
  } catch (error: any) {
    console.error("Database health check failed:", error);
    logSecurityEvent('health_check_db_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    const response = NextResponse.json(
      { 
        ok: false, 
        error: process.env.NODE_ENV === 'development' 
          ? (error.message || "Database connection failed")
          : "Database connection failed",
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
    return addSecurityHeaders(response, request);
  }
}
