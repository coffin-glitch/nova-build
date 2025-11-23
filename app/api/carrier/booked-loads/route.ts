import { addSecurityHeaders, logSecurityEvent } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { requireApiCarrier, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiCarrier(request);
    const userId = auth.userId;

    // Check rate limit for read-only carrier operation
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
    
    console.log("Booked loads - userId:", userId);
    
    // Simplified query first
    const bookedLoads = await sql`
      SELECT 
        lo.id as id,
        l.rr_number,
        l.origin_city,
        l.origin_state,
        l.destination_city,
        l.destination_state,
        lo.offer_amount as revenue,
        l.total_miles as miles,
        l.equipment,
        l.customer_name,
        lo.status,
        lo.created_at as assigned_at
      FROM loads l
      INNER JOIN load_offers lo ON l.rr_number = lo.load_rr_number
      WHERE lo.supabase_user_id = ${userId}
        AND lo.status IN ('accepted', 'assigned', 'checked_in', 'picked_up', 'departed', 'in_transit', 'checked_in_delivery', 'delivered', 'completed')
      ORDER BY lo.created_at DESC
    `;

    console.log("Booked loads - result:", bookedLoads);

    logSecurityEvent('carrier_booked_loads_accessed', userId);
    
    const response = NextResponse.json({
      ok: true,
      data: bookedLoads
    });
    
    return addRateLimitHeaders(addSecurityHeaders(response), rateLimit);

  } catch (error: any) {
    console.error("Error fetching carrier booked loads:", error);
    
    if (error.message === "Unauthorized" || error.message === "Carrier access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('carrier_booked_loads_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to fetch booked loads",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : String(error))
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}
