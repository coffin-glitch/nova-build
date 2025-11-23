import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/admin/bids?limit=200
 * Returns recent telegram_bids rows for the admin table.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireApiAdmin(req);
    const userId = auth.userId;

    // Check rate limit for read-only admin operation
    const rateLimit = await checkApiRateLimit(req, {
      userId,
      routeType: 'readOnly'
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

    const { searchParams } = new URL(req.url);
    const limitParam = searchParams.get("limit") || "200";

    // Input validation
    const validation = validateInput(
      { limitParam },
      {
        limitParam: { type: 'string', pattern: /^\d+$/, maxLength: 10, required: false }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_admin_bids_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    const limit = Math.min(parseInt(limitParam, 10), 1000);

    // Validate limit range
    if (limit < 1 || limit > 1000) {
      logSecurityEvent('invalid_admin_bids_limit', userId, { limit });
      const response = NextResponse.json(
        { error: "Limit must be between 1 and 1000" },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    const rows = await sql`
      SELECT
        bid_number,
        distance_miles,
        pickup_timestamp,
        delivery_timestamp,
        tag,
        received_at,
        expires_at,
        0 as stop_count
      FROM telegram_bids
      ORDER BY received_at DESC
      LIMIT ${limit}
    `;

    logSecurityEvent('admin_bids_accessed', userId, { limit, count: rows.length });
    
    const response = NextResponse.json(rows);
    
    return addRateLimitHeaders(addSecurityHeaders(response), rateLimit);
    
  } catch (error: any) {
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    if (error.message?.includes("Forbidden")) {
      const response = NextResponse.json(
        { error: error.message || "Admin access required" },
        { status: 403 }
      );
      return addSecurityHeaders(response);
    }
    
    logSecurityEvent('admin_bids_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to fetch bids",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}
