import { addSecurityHeaders, logSecurityEvent } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import { NextRequest, NextResponse } from "next/server";

// You can change this dev key to whatever you want
const DEV_KEY = process.env.DEV_ADMIN_KEY || "nova-dev-2024-admin-key";

export async function GET(request: NextRequest) {
  try {
    // Require admin authentication - don't expose dev key to unauthorized users
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
          success: false,
          error: 'Rate limit exceeded',
          message: `Too many requests. Please try again after ${rateLimit.retryAfter} seconds.`,
          retryAfter: rateLimit.retryAfter
        },
        { status: 429 }
      );
      return addRateLimitHeaders(addSecurityHeaders(response), rateLimit);
    }
    
    logSecurityEvent('dev_key_test_accessed', userId);
    
    // Don't expose the actual key in production - only show if it's set
    const response = NextResponse.json({ 
      success: true,
      keyConfigured: !!process.env.DEV_ADMIN_KEY,
      keyLength: DEV_KEY.length,
      message: "Dev key test endpoint - key is configured"
    });
    
    return addSecurityHeaders(response);
    
  } catch (error: any) {
    console.error("❌ Dev key test error:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('dev_key_test_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        success: false, 
        error: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : 'Dev key test failed'
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}
