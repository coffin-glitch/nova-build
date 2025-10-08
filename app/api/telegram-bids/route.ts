import { NextRequest, NextResponse } from "next/server";
import sql from "@/lib/db.server";

// Cache for frequently accessed data
const cache = new Map();
const CACHE_TTL = 30 * 1000; // 30 seconds

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || undefined;
    const tag = searchParams.get("tag") || undefined;
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");

    // Create cache key
    const cacheKey = `telegram-bids-${q}-${tag}-${limit}-${offset}`;
    
    // Check cache first
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json({ 
        ok: true, 
        data: cached.data,
        cached: true 
      });
    }

    // Build optimized query with proper joins
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
      LEFT JOIN LATERAL (
        SELECT amount_cents, clerk_user_id
        FROM public.carrier_bids cb
        WHERE cb.bid_number = tb.bid_number
        ORDER BY amount_cents ASC
        LIMIT 1
      ) lowest_bid ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*) as bids_count
        FROM public.carrier_bids cb
        WHERE cb.bid_number = tb.bid_number
      ) bid_counts ON true
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

    // Cache the result
    cache.set(cacheKey, {
      data: bids,
      timestamp: Date.now()
    });

    // Clean old cache entries periodically
    if (cache.size > 100) {
      const now = Date.now();
      for (const [key, value] of cache.entries()) {
        if (now - value.timestamp > CACHE_TTL) {
          cache.delete(key);
        }
      }
    }

    return NextResponse.json({ 
      ok: true, 
      data: bids,
      cached: false,
      pagination: {
        limit,
        offset,
        hasMore: bids.length === limit,
      },
    });

  } catch (error) {
    console.error("Telegram bids API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch bids" },
      { status: 500 }
    );
  }
}