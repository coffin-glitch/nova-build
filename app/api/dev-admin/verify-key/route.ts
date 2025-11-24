import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import { NextRequest, NextResponse } from "next/server";

// SECURITY FIX: Remove key logging and add authentication
const DEV_KEY = process.env.DEV_ADMIN_KEY || "nova-dev-2024-admin-key";

export async function POST(request: NextRequest) {
  try {
    // SECURITY FIX: Require admin authentication
    const auth = await requireApiAdmin(request);
    const userId = auth.userId;

    // Check rate limit for admin write operation (critical - key verification)
    const rateLimit = await checkApiRateLimit(request, {
      userId,
      routeType: 'critical'
    });

    if (!rateLimit.allowed) {
      const response = NextResponse.json(
        {
          success: false,
          valid: false,
          error: 'Rate limit exceeded',
          message: `Too many requests. Please try again after ${rateLimit.retryAfter} seconds.`,
          retryAfter: rateLimit.retryAfter
        },
        { status: 429 }
      );
      return addRateLimitHeaders(addSecurityHeaders(response), rateLimit);
    }
    
    const { key } = await request.json();
    
    // Input validation
    const validation = validateInput(
      { key },
      {
        key: { required: true, type: 'string', maxLength: 200 }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_dev_key_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { success: false, valid: false, error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }
    
    // SECURITY FIX: Remove sensitive logging
    if (key === DEV_KEY) {
      logSecurityEvent('dev_key_verified', userId);
      const response = NextResponse.json({ 
        success: true,
        valid: true, 
        message: "Dev key accepted" 
      });
      return addSecurityHeaders(response);
    } else {
      logSecurityEvent('dev_key_invalid', userId);
      const response = NextResponse.json({ 
        success: false,
        valid: false, 
        error: "Invalid dev key" 
      });
      return addSecurityHeaders(response);
    }
  } catch (error: any) {
    console.error("❌ Dev key verification error:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('dev_key_verification_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        success: false, 
        valid: false, 
        error: process.env.NODE_ENV === 'development' 
          ? error.message
          : "Failed to verify dev key"
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}
