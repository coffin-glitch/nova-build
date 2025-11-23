import { addSecurityHeaders, logSecurityEvent } from "@/lib/api-security";
import { requireApiCarrier, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    // Ensure user is authenticated (Supabase-only)
    const auth = await requireApiCarrier(request);
    const userId = auth.userId;

    // Delete all notifications for this carrier
    await sql`
      DELETE FROM notifications 
      WHERE user_id = ${userId}
    `;

    logSecurityEvent('carrier_notifications_cleared_all', userId);
    
    const response = NextResponse.json({
      success: true,
      message: "All notifications cleared"
    });
    
    return addSecurityHeaders(response);

  } catch (error: any) {
    console.error("Error clearing carrier notifications:", error);
    
    if (error.message === "Unauthorized" || error.message === "Carrier access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('carrier_notifications_clear_all_error', undefined, { 
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

