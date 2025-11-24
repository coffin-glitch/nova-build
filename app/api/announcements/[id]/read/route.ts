import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { requireApiAuth, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/announcements/[id]/read
 * Mark an announcement as read for the current carrier
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireApiAuth(request);
    const userId = auth.userId;
    const announcementId = params.id;

    // Check rate limit for authenticated write operation
    const rateLimit = await checkApiRateLimit(request, {
      userId,
      routeType: 'authenticated'
    });

    if (!rateLimit.allowed) {
      const response = NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: `Too many requests. Please try again after ${rateLimit.retryAfter} seconds.`,
          retryAfter: rateLimit.retryAfter
        },
        { status: 429 }
      );
      return addRateLimitHeaders(addSecurityHeaders(response), rateLimit);
    }

    // Input validation
    const validation = validateInput(
      { announcementId },
      {
        announcementId: { required: true, type: 'string', pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, maxLength: 50 }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_announcement_read_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // Check if announcement exists and is active
    const [announcement] = await sql`
      SELECT id, is_active, expires_at
      FROM announcements
      WHERE id = ${announcementId}::uuid
    `;

    if (!announcement) {
      const response = NextResponse.json(
        { error: "Announcement not found" },
        { status: 404 }
      );
      return addSecurityHeaders(response);
    }

    if (!announcement.is_active) {
      const response = NextResponse.json(
        { error: "Announcement is not active" },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // Mark as read (upsert to handle duplicates)
    await sql`
      INSERT INTO announcement_reads (announcement_id, carrier_user_id, read_at)
      VALUES (${announcementId}::uuid, ${userId}, NOW())
      ON CONFLICT (announcement_id, carrier_user_id)
      DO UPDATE SET read_at = NOW()
    `;

    // Also mark the corresponding notification as read
    await sql`
      UPDATE notifications
      SET read = true
      WHERE user_id = ${userId}
        AND type = 'announcement'
        AND data->>'announcementId' = ${announcementId}
    `;

    logSecurityEvent('announcement_marked_read', userId, { announcementId });
    
    const response = NextResponse.json({
      success: true,
      message: "Announcement marked as read",
    });
    
    return addSecurityHeaders(response);

  } catch (error: any) {
    console.error("Error marking announcement as read:", error);
    
    if (error.message === "Unauthorized" || error.message === "Authentication required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('announcement_read_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to mark announcement as read",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}

