import { addSecurityHeaders, logSecurityEvent } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiAdmin(request);
    const userId = auth.userId;

    // Check rate limit for read-only admin operation
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

    // Get all offers with load details
    const offers = await sql`
      SELECT 
        lo.id,
        lo.load_rr_number,
        lo.carrier_user_id,
        lo.offer_amount,
        lo.status,
        lo.notes,
        lo.admin_notes,
        lo.counter_amount,
        lo.created_at,
        lo.updated_at,
        l.origin_city,
        l.origin_state,
        l.destination_city,
        l.destination_state,
        l.equipment,
        l.revenue,
        l.total_miles,
        l.pickup_date,
        l.delivery_date,
        l.customer_name
      FROM load_offers lo
      LEFT JOIN loads l ON lo.load_rr_number = l.rr_number
      ORDER BY lo.created_at DESC
    `;

    logSecurityEvent('admin_offers_accessed', userId, { offerCount: offers.length });
    
    const response = NextResponse.json({
      ok: true,
      offers: offers
    });
    
    return addRateLimitHeaders(addSecurityHeaders(response), rateLimit);

  } catch (error: any) {
    console.error("Error fetching admin offers:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('admin_offers_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to fetch offers",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : String(error))
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}
