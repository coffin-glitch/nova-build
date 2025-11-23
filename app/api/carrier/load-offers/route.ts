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

    // Get offers with load details
    const offers = await sql`
      SELECT 
        lo.id,
        lo.load_rr_number,
        lo.offer_amount,
        lo.status,
        lo.created_at,
        lo.updated_at,
        lo.notes,
        lo.counter_amount,
        lo.admin_notes,
        l.rr_number,
        l.origin_city,
        l.origin_state,
        l.destination_city,
        l.destination_state,
        l.equipment,
        l.revenue,
        l.total_miles,
        l.pickup_date,
        l.pickup_time,
        l.delivery_date,
        l.delivery_time,
        l.customer_name,
        l.tm_number
      FROM load_offers lo
      JOIN loads l ON lo.load_rr_number = l.rr_number
      WHERE lo.supabase_user_id = ${userId}
      ORDER BY lo.created_at DESC
    `;

    // Transform the data to match expected structure
    const transformedOffers = offers.map(offer => ({
      id: offer.id,
      load_rr_number: offer.load_rr_number,
      offer_amount: offer.offer_amount,
      status: offer.status,
      created_at: offer.created_at,
      updated_at: offer.updated_at,
      notes: offer.notes,
      counter_amount: offer.counter_amount,
      admin_notes: offer.admin_notes,
      load: {
        rr_number: offer.rr_number,
        origin_city: offer.origin_city,
        origin_state: offer.origin_state,
        destination_city: offer.destination_city,
        destination_state: offer.destination_state,
        equipment: offer.equipment,
        revenue: offer.revenue,
        total_miles: offer.total_miles,
        pickup_date: offer.pickup_date,
        pickup_time: offer.pickup_time,
        delivery_date: offer.delivery_date,
        delivery_time: offer.delivery_time,
        customer_name: offer.customer_name,
        tm_number: offer.tm_number
      }
    }));

    logSecurityEvent('carrier_load_offers_accessed', userId);
    
    const response = NextResponse.json({
      ok: true,
      data: transformedOffers
    });
    
    return addRateLimitHeaders(addSecurityHeaders(response), rateLimit);

  } catch (error: any) {
    console.error("Error fetching carrier load offers:", error);
    
    if (error.message === "Unauthorized" || error.message === "Carrier access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('carrier_load_offers_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to fetch load offers",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : String(error))
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}
