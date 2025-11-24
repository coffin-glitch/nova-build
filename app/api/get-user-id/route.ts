import { addRateLimitHeaders, checkApiRateLimit } from "@/lib/api-rate-limiting";
import { addSecurityHeaders, logSecurityEvent } from "@/lib/api-security";
import { requireApiAuth, unauthorizedResponse } from "@/lib/auth-api-helper";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // Ensure user is authenticated (Supabase-only)
    const auth = await requireApiAuth(request);
    const userId = auth.userId;

    // Check rate limit for authenticated read operation
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
      return addRateLimitHeaders(addSecurityHeaders(response, request), rateLimit);
    }
    
    logSecurityEvent('user_id_accessed', userId);
    
    const response = NextResponse.json({ userId });
    return addRateLimitHeaders(addSecurityHeaders(response, request), rateLimit);
    
  } catch (error: any) {
    console.error("Error getting user ID:", error);
    
    if (error.message === "Unauthorized" || error.message === "Authentication required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('user_id_access_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Not authenticated",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 401 }
    );
    
    return addSecurityHeaders(response, request);
  }
}
