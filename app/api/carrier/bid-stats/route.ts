import { getClerkUserRole } from "@/lib/clerk-server";
import sql from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // Check authentication and carrier role
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const userRole = await getClerkUserRole(userId);
    if (userRole !== "carrier" && userRole !== "admin") {
      return NextResponse.json(
        { error: "Carrier access required" },
        { status: 403 }
      );
    }

    // Get bid statistics for this carrier
    const stats = await sql`
      SELECT 
        COUNT(*) as total_awarded,
        COUNT(CASE WHEN COALESCE(cb.status, 'awarded') IN ('awarded', 'accepted', 'in_progress') THEN 1 END) as active_bids,
        COUNT(CASE WHEN COALESCE(cb.status, 'awarded') = 'completed' THEN 1 END) as completed_bids,
        COALESCE(SUM(aa.winner_amount_cents), 0) as total_revenue,
        COALESCE(AVG(aa.winner_amount_cents), 0) as average_amount
      FROM auction_awards aa
      LEFT JOIN carrier_bids cb ON aa.bid_number = cb.bid_number AND aa.winner_user_id = cb.clerk_user_id
      WHERE aa.winner_user_id = ${userId}
    `;

    const result = stats[0] || {
      total_awarded: 0,
      active_bids: 0,
      completed_bids: 0,
      total_revenue: 0,
      average_amount: 0
    };

    return NextResponse.json({
      ok: true,
      data: {
        totalAwarded: parseInt(result.total_awarded),
        activeBids: parseInt(result.active_bids),
        completedBids: parseInt(result.completed_bids),
        totalRevenue: parseInt(result.total_revenue),
        averageAmount: parseInt(result.average_amount)
      }
    });

  } catch (error) {
    console.error("Error fetching bid stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch bid stats", details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
