import { addSecurityHeaders, logSecurityEvent } from "@/lib/api-security";
import { getApiAuth, unauthorizedResponse } from "@/lib/auth-api-helper";
import { NextRequest, NextResponse } from "next/server";

/**
 * API route to get current user's role
 * Used by client-side hooks when using Supabase auth
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getApiAuth(request);
    
    if (!auth || !auth.userId) {
      return unauthorizedResponse();
    }

    const response = NextResponse.json(
      {
        role: auth.userRole || "carrier",
        userId: auth.userId,
        provider: auth.authProvider,
      }
    );
    
    return addSecurityHeaders(response);
    
  } catch (error: any) {
    console.error('[API /user/role] Error:', error);
    
    if (error.message === "Unauthorized" || error.message === "Authentication required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('user_role_fetch_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: process.env.NODE_ENV === 'development' 
          ? (error.message || "Internal server error")
          : "Internal server error",
        role: "carrier", // Default fallback
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}

