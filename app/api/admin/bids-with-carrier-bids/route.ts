import sql from "@/lib/db";
import { requireApiAdmin } from "@/lib/auth-api-helper";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    await requireApiAdmin(request);

    // Get all unique bid numbers that have carrier bids
    const bidsWithCarrierBids = await sql`
      SELECT
        cb.bid_number,
        COUNT(DISTINCT cb.supabase_user_id) as carrier_bid_count,
        MIN(cb.amount_cents) as lowest_bid_cents,
        MAX(cb.amount_cents) as highest_bid_cents,
        COUNT(*) as total_bids,
        MAX(cb.created_at) as latest_bid_at
      FROM carrier_bids cb
      GROUP BY cb.bid_number
      ORDER BY MAX(cb.created_at) DESC
    `;

    // Get telegram bid details for each bid
    const bidNumbers = bidsWithCarrierBids.map(b => b.bid_number);
    
    if (bidNumbers.length === 0) {
      return NextResponse.json({
        success: true,
        data: []
      });
    }

    const telegramBids = await sql`
      SELECT 
        tb.*,
        (tb.received_at::timestamp + INTERVAL '25 minutes')::text as expires_at_25,
        NOW() > (tb.received_at::timestamp + INTERVAL '25 minutes') as is_expired
      FROM telegram_bids tb
      WHERE tb.bid_number = ANY(${bidNumbers})
    `;

    // Get award information for each bid
    const awards = await sql`
      SELECT 
        aa.bid_number,
        aa.supabase_winner_user_id,
        aa.winner_amount_cents,
        aa.awarded_at,
        cp.legal_name as winner_name,
        cp.mc_number as winner_mc_number,
        cp.company_name as winner_company_name
      FROM auction_awards aa
      LEFT JOIN carrier_profiles cp ON aa.supabase_winner_user_id = cp.supabase_user_id
      WHERE aa.bid_number = ANY(${bidNumbers})
      ORDER BY aa.awarded_at DESC
    `;

    // Create a map of awards by bid number
    const awardMap = new Map();
    awards.forEach(award => {
      awardMap.set(award.bid_number, award);
    });

    // Create a map of telegram bids by bid number
    const telegramBidMap = new Map();
    telegramBids.forEach(tb => {
      telegramBidMap.set(tb.bid_number, tb);
    });

    // Combine all data
    const result = bidsWithCarrierBids.map(bidWithBids => {
      const telegramBid = telegramBidMap.get(bidWithBids.bid_number);
      const award = awardMap.get(bidWithBids.bid_number);

      return {
        bid_number: bidWithBids.bid_number,
        carrier_bid_count: parseInt(bidWithBids.carrier_bid_count) || 0,
        total_bids: parseInt(bidWithBids.total_bids) || 0,
        lowest_bid_cents: parseInt(bidWithBids.lowest_bid_cents) || 0,
        highest_bid_cents: parseInt(bidWithBids.highest_bid_cents) || 0,
        telegram_bid: telegramBid || null,
        award: award || null
      };
    });

    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error("Error fetching bids with carrier bids:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch bids with carrier bids",
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

