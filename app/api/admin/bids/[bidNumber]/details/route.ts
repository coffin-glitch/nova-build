import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import { NextRequest, NextResponse } from "next/server";
import sql from "@/lib/db";

/**
 * API endpoint to fetch a single bid's details by bid_number
 * Queries telegram_bids table directly for exact match
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bidNumber: string }> }
) {
  try {
    const auth = await requireApiAdmin(request);
    const userId = auth.userId;

    // Check rate limit for admin read operation
    const rateLimit = await checkApiRateLimit(request, {
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
    
    const { bidNumber } = await params;

    // Input validation
    const validation = validateInput(
      { bidNumber },
      {
        bidNumber: { required: true, type: 'string', pattern: /^[A-Z0-9\-_]+$/, maxLength: 100 }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_bid_details_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    if (!bidNumber) {
      const response = NextResponse.json(
        { error: "Bid number is required" },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // Query telegram_bids directly by exact bid_number match
    const bid = await sql`
      SELECT 
        tb.*,
        (tb.received_at::timestamp + INTERVAL '25 minutes')::text as expires_at_25,
        NOW() > (tb.received_at::timestamp + INTERVAL '25 minutes') as is_expired,
        COALESCE(lowest_bid.amount_cents, 0) as lowest_amount_cents,
        lowest_bid.supabase_user_id as lowest_user_id,
        COALESCE(bid_counts.bids_count, 0) as bids_count
      FROM telegram_bids tb
      LEFT JOIN (
        SELECT 
          cb1.bid_number,
          cb1.amount_cents,
          cb1.supabase_user_id
        FROM carrier_bids cb1
        WHERE cb1.id = (
          SELECT cb2.id 
          FROM carrier_bids cb2 
          WHERE cb2.bid_number = cb1.bid_number 
          ORDER BY cb2.amount_cents ASC
          LIMIT 1
        )
      ) lowest_bid ON tb.bid_number = lowest_bid.bid_number
      LEFT JOIN (
        SELECT 
          bid_number,
          COUNT(*) as bids_count
        FROM carrier_bids
        GROUP BY bid_number
      ) bid_counts ON tb.bid_number = bid_counts.bid_number
      WHERE tb.bid_number = ${bidNumber}
      LIMIT 1
    `;

    if (bid.length === 0) {
      return NextResponse.json(
        { error: "Bid not found" },
        { status: 404 }
      );
    }

    const bidData = bid[0];
    
    // Calculate time_left_seconds
    const receivedAt = new Date(bidData.received_at);
    const expiresAt = new Date(receivedAt.getTime() + (25 * 60 * 1000));
    const now = new Date();
    const timeLeftMs = Math.max(0, expiresAt.getTime() - now.getTime());
    const timeLeftSeconds = Math.floor(timeLeftMs / 1000);

    // Normalize stops field
    let normalizedStops = null;
    if (bidData.stops) {
      if (Array.isArray(bidData.stops)) {
        normalizedStops = bidData.stops;
      } else if (typeof bidData.stops === 'string') {
        try {
          const parsed = JSON.parse(bidData.stops);
          normalizedStops = Array.isArray(parsed) ? parsed : [parsed];
        } catch {
          normalizedStops = [bidData.stops];
        }
      }
    }

    logSecurityEvent('bid_details_accessed', userId, { bidNumber });
    
    const response = NextResponse.json({
      ok: true,
      data: {
        ...bidData,
        stops: normalizedStops,
        time_left_seconds: timeLeftSeconds,
        stops_count: normalizedStops ? normalizedStops.length : 0,
      }
    });
    
    return addRateLimitHeaders(addSecurityHeaders(response), rateLimit);
    
  } catch (error: any) {
    console.error("Error fetching bid details:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('bid_details_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to fetch bid details",
        details: process.env.NODE_ENV === 'development' 
          ? (error.message || "Failed to fetch bid details")
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}

