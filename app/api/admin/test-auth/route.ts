import { addSecurityHeaders, logSecurityEvent } from "@/lib/api-security";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    console.log("Testing authentication...");
    
    // Test the requireApiAdmin function (Supabase-only)
    const auth = await requireApiAdmin(request);
    const userId = auth.userId;
    const role = auth.userRole;
    
    console.log("Authentication successful:", { userId, role });
    
    logSecurityEvent('test_auth_accessed', userId);
    
    const response = NextResponse.json({
      success: true,
      userId,
      role,
      message: "Authentication test successful"
    });
    
    return addSecurityHeaders(response);

  } catch (error: any) {
    console.error("Authentication test error:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('test_auth_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      {
        success: false,
        error: "Authentication test failed",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}
