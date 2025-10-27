import sql from '@/lib/db';
import { NextRequest, NextResponse } from "next/server";

// Cache for frequently accessed data
const cache = new Map();
const CACHE_TTL = 30 * 1000; // 30 seconds

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || undefined;
    const tag = searchParams.get("tag") || undefined;
    const limit = Math.min(parseInt(searchParams.get("limit") || "1000"), 1000); // Increased limit, max 1000
    const offset = parseInt(searchParams.get("offset") || "0");
    const showExpired = searchParams.get("showExpired") === "true";
    const isAdmin = searchParams.get("isAdmin") === "true";

    // Create cache key
    const cacheKey = `telegram-bids-${q}-${tag}-${limit}-${offset}-${showExpired}-${isAdmin}`;

    // Check cache first
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json({
        ok: true,
        data: cached.data,
        cached: true
      });
    }

    // Insert sample data if none exists
    const count = await sql`SELECT COUNT(*) as count FROM telegram_bids`;
    if (count[0].count === 0) {
      const today = new Date().toISOString().split('T')[0]; // Get today's date in YYYY-MM-DD format
      const sampleBids = [
        // Today's bids
        [`BID${today.replace(/-/g, '')}001`, 250, `${today}T08:00:00Z`, `${today}T18:00:00Z`, JSON.stringify(["Chicago, IL", "Detroit, MI"]), 'URGENT', 'telegram', 'admin', `${today}T07:30:00Z`],
        [`BID${today.replace(/-/g, '')}002`, 400, `${today}T10:00:00Z`, `${today}T20:00:00Z`, JSON.stringify(["Los Angeles, CA", "Phoenix, AZ"]), 'STANDARD', 'telegram', 'admin', `${today}T09:30:00Z`],
        [`BID${today.replace(/-/g, '')}003`, 150, `${today}T12:00:00Z`, `${today}T22:00:00Z`, JSON.stringify(["Miami, FL", "Orlando, FL"]), 'HOT', 'telegram', 'admin', `${today}T11:30:00Z`],
        // Some older bids for context
        ['BID001', 250, '2025-01-15T08:00:00Z', '2025-01-15T18:00:00Z', JSON.stringify(["Chicago, IL", "Detroit, MI"]), 'URGENT', 'telegram', 'admin', '2025-01-15T07:30:00Z'],
        ['BID002', 400, '2025-01-15T10:00:00Z', '2025-01-16T08:00:00Z', JSON.stringify(["Los Angeles, CA", "Phoenix, AZ"]), 'STANDARD', 'telegram', 'admin', '2025-01-15T09:30:00Z'],
        ['BID003', 150, '2025-01-15T12:00:00Z', '2025-01-15T20:00:00Z', JSON.stringify(["Miami, FL", "Orlando, FL"]), 'HOT', 'telegram', 'admin', '2025-01-15T11:30:00Z'],
      ];

      for (const bid of sampleBids) {
        await sql`
          INSERT INTO telegram_bids (bid_number, distance_miles, pickup_timestamp, delivery_timestamp, stops, tag, source_channel, forwarded_to, received_at)
          VALUES (${bid[0]}, ${bid[1]}, ${bid[2]}, ${bid[3]}, ${bid[4]}, ${bid[5]}, ${bid[6]}, ${bid[7]}, ${bid[8]})
        `;
      }
    }

    // Automatically archive expired bids from previous days only
    // This runs for both admin and non-admin users
    await sql`SELECT archive_expired_bids()`;
    
    // Build query with PostgreSQL template literals and daily filtering
    const today = new Date().toISOString().split('T')[0];
    
    // Build WHERE conditions with proper escaping
    let whereConditions = [];
    
    if (q) {
      whereConditions.push(`tb.bid_number LIKE '%${q.replace(/'/g, "''")}%'`);
    }
    
    if (tag) {
      whereConditions.push(`tb.tag = '${tag.toUpperCase().replace(/'/g, "''")}'`);
    }
    
    // For showExpired=false: Show active bids (is_archived = false, countdown still running)
    if (!showExpired) {
      whereConditions.push(`tb.received_at::date = CURRENT_DATE`);
      whereConditions.push(`tb.is_archived = false`);
      whereConditions.push(`NOW() <= (tb.received_at::timestamp + INTERVAL '25 minutes')`); // Only get bids where countdown hasn't expired
    }
    
    // For showExpired=true: Show expired bids (including those marked as archived)
    // These are bids that expired but haven't been end-of-day archived yet
    if (showExpired) {
      whereConditions.push(`tb.archived_at IS NULL`); // Not yet end-of-day archived
      whereConditions.push(`NOW() > (tb.received_at::timestamp + INTERVAL '25 minutes')`); // Only get actually expired bids
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    // Single query with all conditions
    const rows = await sql`
      SELECT 
        tb.*,
        (tb.received_at::timestamp + INTERVAL '25 minutes')::text as expires_at_25,
        NOW() > (tb.received_at::timestamp + INTERVAL '25 minutes') as is_expired,
        0 as stops_count,
        COALESCE(lowest_bid.amount_cents, 0) as lowest_amount_cents,
        lowest_bid.clerk_user_id as lowest_user_id,
        COALESCE(bid_counts.bids_count, 0) as bids_count
      FROM telegram_bids tb
      LEFT JOIN (
        SELECT 
          cb1.bid_number,
          cb1.amount_cents,
          cb1.clerk_user_id
        FROM carrier_bids cb1
        WHERE cb1.id = (
          SELECT cb2.id 
          FROM carrier_bids cb2 
          WHERE cb2.bid_number = cb1.bid_number 
          ORDER BY cb2.amount_cents ASC
          LIMIT 1
        )
      ) lowest_bid ON tb.bid_number = lowest_bid.bid_number
      LEFT JOIN (
        SELECT 
          bid_number,
          COUNT(*) as bids_count
        FROM carrier_bids
        GROUP BY bid_number
      ) bid_counts ON tb.bid_number = bid_counts.bid_number
      ${sql.unsafe(whereClause)}
      ORDER BY tb.received_at DESC 
      LIMIT ${limit} OFFSET ${offset}
    `;

    // Add time_left_seconds to each row
    const bids = rows.map(row => {
      // Calculate time left from received_at + 25 minutes
      const receivedAt = new Date(row.received_at);
      const expiresAt = new Date(receivedAt.getTime() + (25 * 60 * 1000)); // Add 25 minutes
      const now = new Date();
      const timeLeftMs = Math.max(0, expiresAt.getTime() - now.getTime());
      const timeLeftSeconds = Math.floor(timeLeftMs / 1000);
      
      return {
        ...row,
        time_left_seconds: timeLeftSeconds,
        expires_at_25: expiresAt.toISOString(), // Override with correct calculation
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
      { 
        error: "Failed to fetch bids",
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}