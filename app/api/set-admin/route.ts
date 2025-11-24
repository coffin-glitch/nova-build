import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import { setUserRole } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    // CRITICAL: Require admin authentication for setting user roles
    const auth = await requireApiAdmin(request);
    const adminUserId = auth.userId;

    // Check rate limit for admin write operation (critical - role changes)
    const rateLimit = await checkApiRateLimit(request, {
      userId: adminUserId,
      routeType: 'critical'
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
    
    const { userId, role } = await request.json();
    
    // Input validation
    const validation = validateInput(
      { userId, role },
      {
        userId: { required: true, type: 'string', minLength: 1, maxLength: 200 },
        role: { required: true, type: 'string', enum: ['admin', 'carrier'] }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_set_admin_input', adminUserId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }
    
    if (!userId || !role) {
      const response = NextResponse.json(
        { error: "Missing userId or role" },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }
    
    await setUserRole(userId, role);
    
    logSecurityEvent('user_role_set', adminUserId, { targetUserId: userId, role });
    
    const response = NextResponse.json({ 
      success: true, 
      message: `User ${userId} set as ${role}` 
    });
    
    return addSecurityHeaders(response);
    
  } catch (error: any) {
    console.error("Error setting user role:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('set_admin_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to set user role",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}
