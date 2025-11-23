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

    // Get comprehensive load statistics for the carrier
    const stats = await sql`
      WITH offer_stats AS (
        SELECT 
          COUNT(*) as total_offers,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_offers,
          COUNT(CASE WHEN status = 'accepted' THEN 1 END) as accepted_offers,
          COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_offers,
          COALESCE(AVG(offer_amount), 0) as average_offer_amount
        FROM load_offers 
        WHERE supabase_user_id = ${userId}
      ),
      booked_stats AS (
        SELECT 
          COUNT(*) as total_booked,
          COUNT(CASE WHEN lo.status IN ('accepted', 'assigned', 'checked_in', 'picked_up', 'departed', 'in_transit', 'checked_in_delivery') THEN 1 END) as active_loads,
          COUNT(CASE WHEN lo.status = 'completed' THEN 1 END) as completed_loads,
          SUM(lo.offer_amount) as total_revenue
        FROM loads l
        INNER JOIN load_offers lo ON l.rr_number = lo.load_rr_number
        WHERE lo.supabase_user_id = ${userId}
          AND lo.status IN ('accepted', 'assigned', 'checked_in', 'picked_up', 'departed', 'in_transit', 'checked_in_delivery', 'delivered', 'completed')
      )
      SELECT 
        COALESCE(os.total_offers, 0) as total_offers,
        COALESCE(os.pending_offers, 0) as pending_offers,
        COALESCE(os.accepted_offers, 0) as accepted_offers,
        COALESCE(os.rejected_offers, 0) as rejected_offers,
        COALESCE(bs.total_booked, 0) as total_booked,
        COALESCE(bs.active_loads, 0) as active_loads,
        COALESCE(bs.completed_loads, 0) as completed_loads,
        COALESCE(bs.total_revenue, 0) as total_revenue,
        COALESCE(os.average_offer_amount, 0) as average_offer_amount
      FROM offer_stats os
      CROSS JOIN booked_stats bs
    `;

    const result = stats[0] || {
      total_offers: 0,
      pending_offers: 0,
      accepted_offers: 0,
      rejected_offers: 0,
      total_booked: 0,
      active_loads: 0,
      completed_loads: 0,
      total_revenue: 0,
      average_offer_amount: 0
    };

    logSecurityEvent('carrier_load_stats_accessed', userId);
    
    const response = NextResponse.json({
      ok: true,
      data: {
        totalOffers: parseInt(result.total_offers) || 0,
        pendingOffers: parseInt(result.pending_offers) || 0,
        acceptedOffers: parseInt(result.accepted_offers) || 0,
        rejectedOffers: parseInt(result.rejected_offers) || 0,
        totalBooked: parseInt(result.total_booked) || 0,
        activeLoads: parseInt(result.active_loads) || 0,
        completedLoads: parseInt(result.completed_loads) || 0,
        totalRevenue: parseFloat(result.total_revenue) || 0,
        averageOfferAmount: parseFloat(result.average_offer_amount) || 0
      }
    });
    
    return addRateLimitHeaders(addSecurityHeaders(response), rateLimit);

  } catch (error: any) {
    console.error("Error fetching carrier load stats:", error);
    
    if (error.message === "Unauthorized" || error.message === "Carrier access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('carrier_load_stats_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to fetch load statistics",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}
