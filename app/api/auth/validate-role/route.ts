import { getClerkUserRole } from "@/lib/clerk-server";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

/**
 * Secure server-side role validation endpoint
 * This should be used for sensitive operations that require role verification
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ valid: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const requiredRole = searchParams.get('role') as 'admin' | 'carrier';

    if (!requiredRole || !['admin', 'carrier'].includes(requiredRole)) {
      return NextResponse.json({ valid: false, error: "Invalid role" }, { status: 400 });
    }

    // Get user role from server-side (most secure)
    const userRole = await getClerkUserRole(userId);
    
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
      requiredRole 
    });

  } catch (error) {
    console.error('Role validation error:', error);
    return NextResponse.json(
      { valid: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
