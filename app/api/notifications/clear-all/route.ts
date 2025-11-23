import sql from "@/lib/db";
import { requireApiAuth } from "@/lib/auth-api-helper";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    // Ensure user is authenticated (Supabase-only)
    const auth = await requireApiAuth(request);
    const userId = auth.userId;

    // Delete all notifications for this user
    await sql`
      DELETE FROM notifications 
      WHERE user_id = ${userId}
    `;

    logSecurityEvent('notifications_cleared', userId);
    
    const response = NextResponse.json({
      success: true,
      message: "All notifications cleared"
    });
    
    return addSecurityHeaders(response);

  } catch (error: any) {
    console.error("Error clearing notifications:", error);
    
    if (error.message === "Unauthorized" || error.message === "Authentication required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('notifications_clear_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to clear notifications",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}

