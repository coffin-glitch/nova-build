import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { getApiAuth, unauthorizedResponse } from "@/lib/auth-api-helper";
import { NextRequest, NextResponse } from "next/server";

/**
 * Secure server-side role validation endpoint
 * Uses unified auth (Supabase or Clerk)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getApiAuth(request);

    // Check rate limit for authenticated read operation
    const rateLimit = await checkApiRateLimit(request, {
      userId: auth?.userId,
      routeType: 'readOnly'
    });

    if (!rateLimit.allowed) {
      const response = NextResponse.json(
        {
          valid: false,
          error: 'Rate limit exceeded',
          message: `Too many requests. Please try again after ${rateLimit.retryAfter} seconds.`,
          retryAfter: rateLimit.retryAfter
        },
        { status: 429 }
      );
      return addRateLimitHeaders(addSecurityHeaders(response), rateLimit);
    }
    
    if (!auth?.userId) {
      return NextResponse.json({ valid: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const requiredRole = searchParams.get('role') as 'admin' | 'carrier';

    // Input validation
    const validation = validateInput(
      { requiredRole },
      {
        requiredRole: { required: true, type: 'string', enum: ['admin', 'carrier'] }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_role_validation_input', auth.userId, { errors: validation.errors });
      const response = NextResponse.json(
        { valid: false, error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    if (!requiredRole || !['admin', 'carrier'].includes(requiredRole)) {
      const response = NextResponse.json(
        { valid: false, error: "Invalid role" },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // Get user role from unified auth
    const userRole = auth.userRole;
    
    // Validate role with proper hierarchy
    let isValid = false;
    
    if (requiredRole === 'admin') {
      isValid = userRole === 'admin';
    } else if (requiredRole === 'carrier') {
      // Admins can also access carrier routes
      isValid = userRole === 'carrier' || userRole === 'admin';
    }

    logSecurityEvent('role_validation_checked', auth.userId, { 
      requiredRole,
      isValid,
      userRole
    });
    
    const response = NextResponse.json({ 
      valid: isValid,
      userRole,
      requiredRole,
      provider: auth.authProvider
    });
    
    return addSecurityHeaders(response);

  } catch (error: any) {
    console.error('Role validation error:', error);
    
    if (error.message === "Unauthorized" || error.message === "Authentication required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('role_validation_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        valid: false,
        error: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Internal server error')
          : "Internal server error"
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}
