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
      return addRateLimitHeaders(addSecurityHeaders(response, request), rateLimit);
    }

    logSecurityEvent('test_api_accessed', undefined);
    const response = NextResponse.json({ success: true, message: "Test API is working" });
    return addRateLimitHeaders(addSecurityHeaders(response, request), rateLimit);
  } catch (error: any) {
    const { handleApiError } = await import('@/lib/api-security');
    return handleApiError(error, 'test_api_error', undefined, 500, 'Test API error');
  }
}
