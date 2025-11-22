import { addSecurityHeaders, logSecurityEvent } from "@/lib/api-security";
import { requireApiCarrier, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiCarrier(request);
    const userId = auth.userId;

    // Get comprehensive analytics data for the carrier
    const analytics = await sql`
      WITH monthly_offers AS (
        SELECT 
          DATE_TRUNC('month', lo.created_at) as month,
          COUNT(*) as total_offers,
          COUNT(CASE WHEN lo.status = 'accepted' THEN 1 END) as accepted_offers,
          SUM(CASE WHEN lo.status = 'accepted' THEN lo.offer_amount ELSE 0 END) as monthly_revenue
        FROM load_offers lo
        WHERE lo.supabase_user_id = ${userId}
          AND lo.created_at >= CURRENT_DATE - INTERVAL '6 months'
        GROUP BY DATE_TRUNC('month', lo.created_at)
        ORDER BY month
      ),
      performance_metrics AS (
        SELECT 
          COUNT(*) as total_offers,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_offers,
          COUNT(CASE WHEN status = 'accepted' THEN 1 END) as accepted_offers,
          COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_offers,
          AVG(offer_amount) as average_offer_amount,
          SUM(CASE WHEN status = 'accepted' THEN offer_amount ELSE 0 END) as total_revenue
        FROM load_offers 
        WHERE supabase_user_id = ${userId}
      ),
      load_metrics AS (
        SELECT 
          COUNT(*) as total_booked,
          COUNT(CASE WHEN lo.status IN ('accepted', 'assigned', 'checked_in', 'picked_up', 'departed', 'in_transit', 'checked_in_delivery') THEN 1 END) as active_loads,
          COUNT(CASE WHEN lo.status = 'completed' THEN 1 END) as completed_loads,
          AVG(l.miles) as average_miles_per_load
        FROM loads l
        INNER JOIN load_offers lo ON l.rr_number = lo.load_rr_number
        WHERE lo.supabase_user_id = ${userId}
          AND lo.status IN ('accepted', 'assigned', 'checked_in', 'picked_up', 'departed', 'in_transit', 'checked_in_delivery', 'delivered', 'completed')
      )
      SELECT 
        COALESCE(pm.total_offers, 0) as total_offers,
        COALESCE(pm.pending_offers, 0) as pending_offers,
        COALESCE(pm.accepted_offers, 0) as accepted_offers,
        COALESCE(pm.rejected_offers, 0) as rejected_offers,
        COALESCE(pm.average_offer_amount, 0) as average_offer_amount,
        COALESCE(pm.total_revenue, 0) as total_revenue,
        COALESCE(lm.total_booked, 0) as total_booked,
        COALESCE(lm.active_loads, 0) as active_loads,
        COALESCE(lm.completed_loads, 0) as completed_loads,
        COALESCE(lm.average_miles_per_load, 0) as average_miles_per_load,
        json_agg(
          json_build_object(
            'month', mo.month,
            'offers', mo.total_offers,
            'accepted', mo.accepted_offers,
            'revenue', mo.monthly_revenue
          ) ORDER BY mo.month
        ) as monthly_data
      FROM performance_metrics pm
      CROSS JOIN load_metrics lm
      LEFT JOIN monthly_offers mo ON true
      GROUP BY 
        pm.total_offers, pm.pending_offers, pm.accepted_offers, pm.rejected_offers,
        pm.average_offer_amount, pm.total_revenue,
        lm.total_booked, lm.active_loads, lm.completed_loads, lm.average_miles_per_load
    `;

    const result = analytics[0] || {
      total_offers: 0,
      pending_offers: 0,
      accepted_offers: 0,
      rejected_offers: 0,
      average_offer_amount: 0,
      total_revenue: 0,
      total_booked: 0,
      active_loads: 0,
      completed_loads: 0,
      average_miles_per_load: 0,
      monthly_data: []
    };

    logSecurityEvent('carrier_load_analytics_accessed', userId);
    
    const response = NextResponse.json({
      ok: true,
      data: {
        stats: {
          totalOffers: result.total_offers,
          pendingOffers: result.pending_offers,
          acceptedOffers: result.accepted_offers,
          rejectedOffers: result.rejected_offers,
          averageOfferAmount: result.average_offer_amount,
          totalRevenue: result.total_revenue,
          totalBooked: result.total_booked,
          activeLoads: result.active_loads,
          completedLoads: result.completed_loads,
          averageMilesPerLoad: result.average_miles_per_load
        },
        monthlyData: result.monthly_data || []
      }
    });
    
    return addSecurityHeaders(response);

  } catch (error: any) {
    console.error("Error fetching carrier analytics:", error);
    
    if (error.message === "Unauthorized" || error.message === "Carrier access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('carrier_load_analytics_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to fetch analytics data",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}
