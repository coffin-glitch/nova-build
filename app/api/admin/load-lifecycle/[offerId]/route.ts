import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ offerId: string }> }
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

    const { offerId } = await params;

    // Input validation
    const validation = validateInput(
      { offerId },
      {
        offerId: { required: true, type: 'string', pattern: /^\d+$/, maxLength: 20 }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_load_lifecycle_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // Validate offerId is a valid number
    const offerIdNum = Number(offerId);
    if (isNaN(offerIdNum) || offerIdNum <= 0) {
      logSecurityEvent('invalid_load_lifecycle_offerid', userId, { offerId });
      const response = NextResponse.json(
        { error: "Invalid offer ID" },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // Get load lifecycle events for the offer
    const events = await sql`
      SELECT 
        lle.id,
        lle.status,
        lle.timestamp,
        lle.notes,
        lle.check_in_time,
        lle.pickup_time,
        lle.departure_time,
        lle.delivery_time,
        lle.driver_name,
        lle.truck_number,
        lle.trailer_number,
        lo.status as current_status
      FROM load_lifecycle_events lle
      INNER JOIN load_offers lo ON lle.load_offer_id = lo.id
      WHERE lo.id = ${offerId}
      ORDER BY lle.timestamp ASC
    `;

    const currentStatus = events.length > 0 ? events[events.length - 1].status : 'pending';

    logSecurityEvent('load_lifecycle_accessed', userId, { offerId, eventCount: events.length });
    
    const response = NextResponse.json({
      ok: true,
      data: {
        events: events.map((event: any) => ({
          id: event.id,
          status: event.status,
          timestamp: event.timestamp,
          notes: event.notes,
          check_in_time: event.check_in_time,
          pickup_time: event.pickup_time,
          departure_time: event.departure_time,
          delivery_time: event.delivery_time,
          driver_name: event.driver_name,
          truck_number: event.truck_number,
          trailer_number: event.trailer_number
        })),
        currentStatus
      }
    });
    
    return addRateLimitHeaders(addSecurityHeaders(response), rateLimit);

  } catch (error: any) {
    console.error("Error fetching admin load lifecycle:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('load_lifecycle_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to fetch lifecycle data",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}
