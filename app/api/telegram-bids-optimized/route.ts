import { NextRequest, NextResponse } from "next/server";
import { optimizedQueries } from "@/lib/db-optimized";
import sql from "@/lib/db";

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

    // Build optimized query
    let query = optimizedQueries.getActiveTelegramBids(limit, offset);
    
    if (q) {
      query = sql.unsafe(`${query} AND tb.bid_number ILIKE ${'%' + q.replace(/'/g, "''") + '%'}`);
    }

    if (tag) {
      query = sql.unsafe(`${query} AND tb.tag = '${tag.toUpperCase().replace(/'/g, "''")}'`);
    }

    const rows = await query;

    // Cache the result
    cache.set(cacheKey, {
      data: rows,
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
      data: rows,
      cached: false 
    });

  } catch (error) {
    console.error("Telegram bids API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch bids" },
      { status: 500 }
    );
  }
}

