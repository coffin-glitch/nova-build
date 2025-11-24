import { addSecurityHeaders, logSecurityEvent } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // Check rate limit for public read operation
    const rateLimit = await checkApiRateLimit(request, {
      routeType: 'public'
    });

    if (!rateLimit.allowed) {
      const response = NextResponse.json(
        {
          success: false,
          error: 'Rate limit exceeded',
          message: `Too many requests. Please try again after ${rateLimit.retryAfter} seconds.`,
          retryAfter: rateLimit.retryAfter
        },
        { status: 429 }
      );
      return addRateLimitHeaders(addSecurityHeaders(response), rateLimit);
    }

    logSecurityEvent('test_api_accessed', undefined);
    const response = NextResponse.json({ success: true, message: "Test API is working" });
    return addRateLimitHeaders(addSecurityHeaders(response), rateLimit);
  } catch (error: any) {
    console.error("Test API error:", error);
    logSecurityEvent('test_api_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    const response = NextResponse.json(
      { 
        error: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : 'Test API error'
      },
      { status: 500 }
    );
    return addSecurityHeaders(response);
  }
}
