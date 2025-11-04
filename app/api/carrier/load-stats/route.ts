import sql from "@/lib/db";
import { requireApiCarrier } from "@/lib/auth-api-helper";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiCarrier(request);
    const userId = auth.userId;

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

    return NextResponse.json({
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

  } catch (error) {
    console.error("Error fetching carrier load stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch load statistics" },
      { status: 500 }
    );
  }
}
