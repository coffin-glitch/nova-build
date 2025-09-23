import { NextRequest, NextResponse } from "next/server";
import sql from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || undefined;
    const tag = searchParams.get("tag") || undefined;
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build query with bidding information
    let query = sql`
      SELECT 
        tb.*,
        tb.received_at + INTERVAL '25 minutes' as expires_at_25,
        NOW() > (tb.received_at + INTERVAL '25 minutes') as is_expired,
        COALESCE(jsonb_array_length(tb.stops), 0) as stops_count,
        COALESCE(lowest_bid.amount_cents, 0) as lowest_amount_cents,
        lowest_bid.clerk_user_id as lowest_user_id,
        COALESCE(bid_counts.bids_count, 0) as bids_count
      FROM public.telegram_bids tb
      LEFT JOIN (
        SELECT 
          bid_number,
          amount_cents,
          clerk_user_id,
          ROW_NUMBER() OVER (PARTITION BY bid_number ORDER BY amount_cents ASC) as rn
        FROM public.carrier_bids
      ) lowest_bid ON tb.bid_number = lowest_bid.bid_number AND lowest_bid.rn = 1
      LEFT JOIN (
        SELECT 
          bid_number,
          COUNT(*) as bids_count
        FROM public.carrier_bids
        GROUP BY bid_number
      ) bid_counts ON tb.bid_number = bid_counts.bid_number
      WHERE 1=1
    `;

    if (q) {
      query = sql`${query} AND tb.bid_number ILIKE ${'%' + q + '%'}`;
    }

    if (tag) {
      query = sql`${query} AND tb.tag = ${tag.toUpperCase()}`;
    }

    query = sql`${query} ORDER BY tb.received_at DESC LIMIT ${limit} OFFSET ${offset}`;

    const rows = await query;
    
    // Add time_left_seconds to each row
    const bids = rows.map(row => {
      const expiresAt = new Date(row.expires_at_25);
      const now = new Date();
      const timeLeftMs = Math.max(0, expiresAt.getTime() - now.getTime());
      const timeLeftSeconds = Math.floor(timeLeftMs / 1000);
      
      return {
        ...row,
        time_left_seconds: timeLeftSeconds,
      };
    });

    return NextResponse.json({
      ok: true,
      data: bids,
      pagination: {
        limit,
        offset,
        hasMore: bids.length === limit,
      },
    });
  } catch (error: any) {
    console.error("Telegram bids API error:", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}
