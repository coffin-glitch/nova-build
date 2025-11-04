import { getApiAuth, unauthorizedResponse } from "@/lib/auth-api-helper";
import { NextRequest, NextResponse } from "next/server";

/**
 * Secure server-side role validation endpoint
 * Uses unified auth (Supabase or Clerk)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = getApiAuth(request);
    
    if (!auth.userId) {
      return NextResponse.json({ valid: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const requiredRole = searchParams.get('role') as 'admin' | 'carrier';

    if (!requiredRole || !['admin', 'carrier'].includes(requiredRole)) {
      return NextResponse.json({ valid: false, error: "Invalid role" }, { status: 400 });
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

    return NextResponse.json({ 
      valid: isValid,
      userRole,
      requiredRole,
      provider: auth.authProvider
    });

  } catch (error: any) {
    console.error('Role validation error:', error);
    if (error.message === "Unauthorized") {
      return unauthorizedResponse();
    }
    return NextResponse.json(
      { valid: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
