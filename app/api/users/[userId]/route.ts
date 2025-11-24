import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { getSupabaseUserInfo } from "@/lib/auth-unified";
import { requireApiAuth, unauthorizedResponse } from "@/lib/auth-api-helper";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    // Require authentication to view user info
    const auth = await requireApiAuth(request);
    const requesterUserId = auth.userId;
    
    const { userId } = await params;

    // Check rate limit for authenticated read operation
    const rateLimit = await checkApiRateLimit(request, {
      userId: requesterUserId,
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
    
    // Input validation
    const validation = validateInput(
      { userId },
      {
        userId: { required: true, type: 'string', maxLength: 200 }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_user_info_input', requesterUserId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response, request);
    }
    
    if (!userId) {
      const response = NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
      return addSecurityHeaders(response, request);
    }

    const userInfo = await getSupabaseUserInfo(userId);
    
    logSecurityEvent('user_info_accessed', requesterUserId, { targetUserId: userId });
    
    const response = NextResponse.json(userInfo);
    return addRateLimitHeaders(addSecurityHeaders(response, request), rateLimit);
    
  } catch (error: any) {
    console.error("Error fetching user info:", error);
    
    if (error.message === "Unauthorized" || error.message === "Authentication required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('user_info_fetch_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to fetch user information",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response, request);
  }
}
