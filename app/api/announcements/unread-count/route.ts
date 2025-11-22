import { addSecurityHeaders, logSecurityEvent } from "@/lib/api-security";
import { requireApiAuth, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/announcements/unread-count
 * Get unread announcements count for the current user
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiAuth(request);
    const userId = auth.userId;

    const unreadCount = await sql`
      SELECT COUNT(*) as count
      FROM announcements a
      LEFT JOIN announcement_reads ar ON a.id = ar.announcement_id AND ar.carrier_user_id = ${userId}
      WHERE a.is_active = true
        AND (a.expires_at IS NULL OR a.expires_at > NOW())
        AND ar.id IS NULL
    `;

    const response = NextResponse.json({
      success: true,
      unreadCount: parseInt(unreadCount[0].count),
    });
    
    return addSecurityHeaders(response);

  } catch (error: any) {
    console.error("Error fetching unread count:", error);
    
    if (error.message === "Unauthorized" || error.message === "Authentication required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('announcement_unread_count_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to fetch unread count",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}

