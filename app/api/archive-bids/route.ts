import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { requireApiAdmin } from "@/lib/auth-api-helper";
import sql from '@/lib/db';
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // Require admin authentication for viewing archived bids
    const auth = await requireApiAdmin(request);
    const userId = auth.userId;

    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    const city = searchParams.get("city");
    const state = searchParams.get("state");
    const milesMinParam = searchParams.get("milesMin");
    const milesMaxParam = searchParams.get("milesMax");
    const sortBy = searchParams.get("sortBy") || "archived_at";
    const limitParam = searchParams.get("limit") || "100";
    const offsetParam = searchParams.get("offset") || "0";

    // Input validation
    const validation = validateInput(
      { date, city, state, milesMin: milesMinParam, milesMax: milesMaxParam, sortBy, limit: limitParam, offset: offsetParam },
      {
        date: { type: 'string', pattern: /^\d{4}-\d{2}-\d{2}$/, required: false },
        city: { type: 'string', maxLength: 100, required: false },
        state: { type: 'string', maxLength: 2, required: false },
        milesMin: { type: 'string', pattern: /^\d+$/, required: false },
        milesMax: { type: 'string', pattern: /^\d+$/, required: false },
        sortBy: { type: 'string', enum: ['archived_at', 'distance', 'pickup', 'state'], required: false },
        limit: { type: 'string', pattern: /^\d+$/, required: false },
        offset: { type: 'string', pattern: /^\d+$/, required: false }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_archive_bids_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    const limit = Math.min(parseInt(limitParam), 100); // Max 100
    const offset = Math.max(0, parseInt(offsetParam)); // Ensure non-negative
    const milesMin = milesMinParam ? parseInt(milesMinParam) : null;
    const milesMax = milesMaxParam ? parseInt(milesMaxParam) : null;

    // Build query with parameterized conditions to prevent SQL injection
    let baseQuery = sql`
      SELECT 
        tb.*,
        COALESCE(bid_counts.bids_count, 0) as bids_count,
        COALESCE(lowest_bid.amount_cents / 100.0, 0) as lowest_bid_amount
      FROM telegram_bids tb
      LEFT JOIN (
        SELECT 
          bid_number,
          COUNT(*) as bids_count
        FROM carrier_bids
        GROUP BY bid_number
      ) bid_counts ON tb.bid_number = bid_counts.bid_number
      LEFT JOIN (
        SELECT 
          cb1.bid_number,
          cb1.amount_cents
        FROM carrier_bids cb1
        WHERE cb1.id = (
          SELECT cb2.id 
          FROM carrier_bids cb2 
          WHERE cb2.bid_number = cb1.bid_number 
          ORDER BY cb2.amount_cents ASC
          LIMIT 1
        )
      ) lowest_bid ON tb.bid_number = lowest_bid.bid_number
      WHERE tb.archived_at IS NOT NULL
    `;

    // Add parameterized WHERE conditions
    if (date) {
      baseQuery = sql`${baseQuery} AND DATE(tb.archived_at AT TIME ZONE 'America/Chicago') = ${date}`;
    }
    
    if (city) {
      baseQuery = sql`${baseQuery} AND tb.stops::text ILIKE ${'%' + city + '%'}`;
    }
    
    if (state) {
      baseQuery = sql`${baseQuery} AND tb.tag = ${state.toUpperCase()}`;
    }
    
    if (milesMin !== null) {
      baseQuery = sql`${baseQuery} AND tb.distance_miles >= ${milesMin}`;
    }
    
    if (milesMax !== null) {
      baseQuery = sql`${baseQuery} AND tb.distance_miles <= ${milesMax}`;
    }

    // Add ORDER BY
    switch (sortBy) {
      case "distance":
        baseQuery = sql`${baseQuery} ORDER BY tb.distance_miles ASC`;
        break;
      case "pickup":
        baseQuery = sql`${baseQuery} ORDER BY tb.pickup_timestamp ASC`;
        break;
      case "state":
        baseQuery = sql`${baseQuery} ORDER BY tb.tag ASC`;
        break;
      case "archived_at":
      default:
        baseQuery = sql`${baseQuery} ORDER BY tb.archived_at DESC`;
        break;
    }

    baseQuery = sql`${baseQuery} LIMIT ${limit} OFFSET ${offset}`;
    const rows = await baseQuery;

    // Get total count for pagination (with same filters)
    let countQuery = sql`
      SELECT COUNT(*) as total
      FROM telegram_bids tb
      WHERE tb.archived_at IS NOT NULL
    `;

    if (date) {
      countQuery = sql`${countQuery} AND DATE(tb.archived_at AT TIME ZONE 'America/Chicago') = ${date}`;
    }
    if (city) {
      countQuery = sql`${countQuery} AND tb.stops::text ILIKE ${'%' + city + '%'}`;
    }
    if (state) {
      countQuery = sql`${countQuery} AND tb.tag = ${state.toUpperCase()}`;
    }
    if (milesMin !== null) {
      countQuery = sql`${countQuery} AND tb.distance_miles >= ${milesMin}`;
    }
    if (milesMax !== null) {
      countQuery = sql`${countQuery} AND tb.distance_miles <= ${milesMax}`;
    }

    const countResult = await countQuery;

    const total = countResult[0]?.total || 0;

    // Get date range for filtering
    // Convert archived_at from UTC to CDT
    const dateRange = await sql`
      SELECT 
        MIN(DATE(archived_at AT TIME ZONE 'America/Chicago')) as earliest_date,
        MAX(DATE(archived_at AT TIME ZONE 'America/Chicago')) as latest_date
      FROM telegram_bids
      WHERE archived_at IS NOT NULL
    `;

    logSecurityEvent('archive_bids_accessed', userId);
    
    const response = NextResponse.json({
      ok: true,
      data: rows,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      },
      dateRange: dateRange[0] || { earliest_date: null, latest_date: null }
    });
    
    return addSecurityHeaders(response);

  } catch (error: any) {
    console.error("Error fetching archived bids:", error);
    
    // Handle auth errors
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      const response = NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
      return addSecurityHeaders(response);
    }
    
    logSecurityEvent('archive_bids_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to fetch archived bids",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Require admin authentication for cleanup operations
    const auth = await requireApiAdmin(request);
    const userId = auth.userId;

    const { searchParams } = new URL(request.url);
    const olderThanDaysParam = searchParams.get("olderThanDays") || "90";

    // Input validation
    const validation = validateInput(
      { olderThanDays: olderThanDaysParam },
      {
        olderThanDays: { type: 'string', pattern: /^\d+$/, required: false }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_archive_cleanup_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    const olderThanDays = Math.min(Math.max(parseInt(olderThanDaysParam), 1), 365); // Between 1 and 365 days
    
    // Clean up old archived bids
    const deletedCount = await sql`
      SELECT cleanup_old_archived_bids()
    `;

    logSecurityEvent('archive_bids_cleaned', userId, { olderThanDays });
    
    const response = NextResponse.json({
      ok: true,
      message: `Cleaned up archived bids older than ${olderThanDays} days`,
      deletedCount: deletedCount[0]?.cleanup_old_archived_bids || 0
    });
    
    return addSecurityHeaders(response);

  } catch (error: any) {
    console.error("Error cleaning up archived bids:", error);
    
    // Handle auth errors
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      const response = NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
      return addSecurityHeaders(response);
    }
    
    logSecurityEvent('archive_cleanup_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to clean up archived bids",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}