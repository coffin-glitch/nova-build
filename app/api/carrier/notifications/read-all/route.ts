import { addSecurityHeaders, logSecurityEvent } from "@/lib/api-security";
import { requireApiCarrier, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiCarrier(request);
    const userId = auth.userId;

    // Mark all notifications as read for the carrier (using main notifications table)
    await sql`
      UPDATE notifications 
      SET read = true
      WHERE user_id = ${userId} AND read = false
    `;

    logSecurityEvent('carrier_notifications_marked_read_all', userId);
    
    const response = NextResponse.json({
      ok: true,
      message: "All notifications marked as read"
    });
    
    return addSecurityHeaders(response);

  } catch (error: any) {
    console.error("Error marking all notifications as read:", error);
    
    if (error.message === "Unauthorized" || error.message === "Carrier access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('carrier_notifications_read_all_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to mark all notifications as read",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}
