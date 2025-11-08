import sql from "@/lib/db";
import { requireApiCarrier } from "@/lib/auth-api-helper";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiCarrier(request);
    const userId = auth.userId;

    // Get awarded bids for this carrier
    console.log(`[Carrier Awarded Bids] Fetching for user: ${userId}`);
    
    // Note: winner_user_id and awarded_by were removed in migration 078
    // Only supabase_winner_user_id and supabase_awarded_by exist now
    // IMPORTANT: margin_cents is NEVER exposed to carriers - admin-only analytics data
    const awardedBids = await sql`
      SELECT 
        aa.id,
        aa.bid_number,
        aa.supabase_winner_user_id as winner_user_id,
        aa.winner_amount_cents,
        aa.supabase_awarded_by as awarded_by,
        COALESCE(ap.display_name, ap.display_email, ur.email, aa.supabase_awarded_by::text) as awarded_by_name,
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
        -- margin_cents is intentionally excluded - admin-only analytics data
      FROM auction_awards aa
      LEFT JOIN telegram_bids tb ON aa.bid_number = tb.bid_number
      LEFT JOIN carrier_bids cb ON aa.bid_number = cb.bid_number 
        AND cb.supabase_user_id = aa.supabase_winner_user_id
      LEFT JOIN user_roles_cache ur ON aa.supabase_awarded_by = ur.supabase_user_id
      LEFT JOIN admin_profiles ap ON aa.supabase_awarded_by = ap.supabase_user_id
      WHERE aa.supabase_winner_user_id = ${userId}
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
