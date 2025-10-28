import { requireAdmin } from "@/lib/clerk-server";
import sql from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // This will redirect if user is not admin
    await requireAdmin();

    // Get bid statistics
    // Use LEFT JOIN to include awarded bids even if carrier hasn't accepted yet
    const stats = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN COALESCE(cb.status, 'awarded') = 'active' THEN 1 END) as active,
        COUNT(CASE WHEN COALESCE(cb.status, 'awarded') = 'completed' THEN 1 END) as completed,
        COALESCE(SUM(aa.winner_amount_cents), 0) as revenue
      FROM auction_awards aa
      LEFT JOIN carrier_bids cb ON aa.bid_number = cb.bid_number AND aa.winner_user_id = cb.clerk_user_id
    `;

    const result = stats[0] || { total: 0, active: 0, completed: 0, revenue: 0 };

    return NextResponse.json({
      total: parseInt(result.total) || 0,
      active: parseInt(result.active) || 0,
      completed: parseInt(result.completed) || 0,
      revenue: parseInt(result.revenue) || 0
    });
  } catch (error) {
    console.error("Error fetching bid stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch bid statistics" },
      { status: 500 }
    );
  }
}
