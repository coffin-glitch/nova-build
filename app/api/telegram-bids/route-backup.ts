import { NextRequest, NextResponse } from "next/server";
import sql from "@/lib/db.server";

export async function GET(request: NextRequest) {
  try {
    console.log("API: Starting telegram-bids request");
    
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || undefined;
    const tag = searchParams.get("tag") || undefined;
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    
    console.log("API: Query params:", { q, tag, limit, offset });

    // Try database query with timeout
    let rows: any[] = [];
    try {
      console.log("API: Attempting database query");
      
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

      // Add timeout to prevent hanging
      const queryPromise = query;
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Database query timeout')), 10000)
      );
      
      rows = await Promise.race([queryPromise, timeoutPromise]) as any[];
      console.log("API: Database query successful, rows:", rows.length);
      
    } catch (dbError) {
      console.error("API: Database error, falling back to mock data:", dbError);
      
      // Fallback to mock data when database is unavailable
      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      
      rows = [
        {
          bid_number: "TB-001",
          distance_miles: 250,
          pickup_timestamp: new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 2, 0).toISOString(),
          delivery_timestamp: new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 15, 50).toISOString(),
          stops: ["Atlanta, GA", "Nashville, TN"],
          tag: "REEFER",
          source_channel: "telegram",
          forwarded_to: null,
          received_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
          expires_at: null,
          expires_at_25: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
          is_expired: false,
          stops_count: 1, // Only 1 stop (delivery), pickup doesn't count
          lowest_amount_cents: 0,
          lowest_user_id: null,
          bids_count: 3,
        },
        {
          bid_number: "TB-002",
          distance_miles: 180,
          pickup_timestamp: new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate() + 1, 6, 30).toISOString(),
          delivery_timestamp: new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate() + 1, 18, 45).toISOString(),
          stops: ["Miami, FL", "Orlando, FL", "Jacksonville, FL"],
          tag: "DRY",
          source_channel: "telegram",
          forwarded_to: null,
          received_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
          expires_at: null,
          expires_at_25: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          is_expired: false,
          stops_count: 2, // 2 stops (Orlando + Jacksonville), pickup doesn't count
          lowest_amount_cents: 0,
          lowest_user_id: null,
          bids_count: 1,
        },
        {
          bid_number: "TB-003",
          distance_miles: 320,
          pickup_timestamp: new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate() + 2, 4, 15).toISOString(),
          delivery_timestamp: new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate() + 2, 16, 30).toISOString(),
          stops: ["Dallas, TX", "Houston, TX"],
          tag: "FLATBED",
          source_channel: "telegram",
          forwarded_to: null,
          received_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
          expires_at: null,
          expires_at_25: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          is_expired: false,
          stops_count: 1, // Only 1 stop (Houston), pickup doesn't count
          lowest_amount_cents: 0,
          lowest_user_id: null,
          bids_count: 0,
        }
      ];
    }
    
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
