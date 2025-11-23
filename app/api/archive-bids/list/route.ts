import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from '@/lib/db';
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // Require admin authentication for archive access
    const auth = await requireApiAdmin(request);
    const userId = auth.userId;
    
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") || undefined;
    const city = searchParams.get("city") || undefined;
    const state = searchParams.get("state") || undefined;
    const milesMin = searchParams.get("milesMin") || undefined;
    const milesMax = searchParams.get("milesMax") || undefined;
    const sortBy = searchParams.get("sortBy") || "date";
    const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");

    // Input validation
    const validation = validateInput(
      { date, city, state, milesMin, milesMax, sortBy, limit, offset },
      {
        date: { type: 'string', pattern: /^\d{4}-\d{2}-\d{2}$/, maxLength: 10, required: false },
        city: { type: 'string', maxLength: 100, required: false },
        state: { type: 'string', maxLength: 100, required: false },
        milesMin: { type: 'string', pattern: /^\d+$/, maxLength: 10, required: false },
        milesMax: { type: 'string', pattern: /^\d+$/, maxLength: 10, required: false },
        sortBy: { type: 'string', enum: ['date', 'bids'], required: false },
        limit: { type: 'number', min: 1, max: 100 },
        offset: { type: 'number', min: 0 }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_archive_list_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // Build query using parameterized queries (fixes SQL injection)
    // Use conditional WHERE clauses with sql template literals
    const rows = await sql`
      SELECT 
        tb.*,
        CASE 
          WHEN tb.stops IS NOT NULL AND tb.stops != '' 
          THEN 0
          ELSE 0 
        END as stops_count,
        COALESCE(bid_counts.bids_count, 0) as bids_count,
        COALESCE(lowest_bid.amount_cents, 0) as lowest_amount_cents,
        lowest_bid.supabase_user_id as lowest_user_id
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
          cb1.amount_cents,
          cb1.supabase_user_id
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
        ${date ? sql`AND DATE(archived_at AT TIME ZONE 'America/Chicago') = ${date}::date` : sql``}
        ${city ? sql`AND LOWER(stops) LIKE LOWER(${'%' + city + '%'})` : sql``}
        ${state ? sql`AND LOWER(tag) LIKE LOWER(${'%' + state + '%'})` : sql``}
        ${milesMin ? sql`AND distance_miles >= ${parseInt(milesMin)}` : sql``}
        ${milesMax ? sql`AND distance_miles <= ${parseInt(milesMax)}` : sql``}
      ${sortBy === 'bids' 
        ? sql`ORDER BY archived_at DESC, distance_miles ASC`
        : sql`ORDER BY archived_at DESC, received_at DESC`}
      LIMIT ${limit} OFFSET ${offset}
    `;

    // Get total count for pagination
    const countResult = await sql`
      SELECT COUNT(*) as total
      FROM telegram_bids tb
      WHERE tb.archived_at IS NOT NULL
        ${date ? sql`AND DATE(archived_at AT TIME ZONE 'America/Chicago') = ${date}::date` : sql``}
        ${city ? sql`AND LOWER(stops) LIKE LOWER(${'%' + city + '%'})` : sql``}
        ${state ? sql`AND LOWER(tag) LIKE LOWER(${'%' + state + '%'})` : sql``}
        ${milesMin ? sql`AND distance_miles >= ${parseInt(milesMin)}` : sql``}
        ${milesMax ? sql`AND distance_miles <= ${parseInt(milesMax)}` : sql``}
    `;
    const total = parseInt(countResult[0]?.total || '0');

    // Get archive statistics by date
    const stats = await sql`
      SELECT 
        DATE(archived_at AT TIME ZONE 'America/Chicago') as archived_date,
        COUNT(*) as bid_count,
        AVG(distance_miles) as avg_distance,
        MIN(distance_miles) as min_distance,
        MAX(distance_miles) as max_distance
      FROM telegram_bids
      WHERE archived_at IS NOT NULL
      GROUP BY DATE(archived_at AT TIME ZONE 'America/Chicago')
      ORDER BY archived_date DESC
      LIMIT 30
    `;

    logSecurityEvent('archive_bids_list_accessed', userId, { 
      filters: { date, city, state, milesMin, milesMax, sortBy }
    });
    
    const response = NextResponse.json({
      ok: true,
      data: rows,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      },
      stats: stats,
      filters: {
        date,
        city,
        state,
        milesMin,
        milesMax,
        sortBy
      }
    });
    
    return addSecurityHeaders(response);

  } catch (error: any) {
    console.error("Archived bids API error:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('archive_bids_list_error', undefined, { 
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
