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

    // Get awarded bids for this carrier
    console.log(`[Carrier Awarded Bids] Fetching for user: ${userId}`);
    
    const awardedBids = await sql`
      SELECT 
        aa.id,
        aa.bid_number,
        aa.winner_user_id,
        aa.winner_amount_cents,
        aa.awarded_by,
        aa.awarded_at,
        tb.distance_miles,
        tb.pickup_timestamp,
        tb.delivery_timestamp,
        tb.stops,
        tb.tag,
        tb.source_channel,
        COALESCE(cb.status, 'awarded') as status,
        cb.lifecycle_notes as notes,
        cb.updated_at
      FROM auction_awards aa
      LEFT JOIN telegram_bids tb ON aa.bid_number = tb.bid_number
      LEFT JOIN carrier_bids cb ON aa.bid_number = cb.bid_number AND aa.winner_user_id = cb.clerk_user_id
      WHERE aa.winner_user_id = ${userId}
      ORDER BY aa.awarded_at DESC
    `;

    console.log(`[Carrier Awarded Bids] Found ${awardedBids.length} bids for user ${userId}`);
    console.log(`[Carrier Awarded Bids] Bid numbers: ${awardedBids.map(b => b.bid_number).join(', ')}`);

    return NextResponse.json({
      ok: true,
      data: awardedBids
    });

  } catch (error) {
    console.error("Error fetching awarded bids:", error);
    return NextResponse.json(
      { error: "Failed to fetch awarded bids", details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
