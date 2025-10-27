import sql from '@/lib/db';
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    const city = searchParams.get("city");
    const state = searchParams.get("state");
    const milesMin = searchParams.get("milesMin");
    const milesMax = searchParams.get("milesMax");
    const sortBy = searchParams.get("sortBy") || "archived_at";
    const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build WHERE conditions
    let whereConditions = [];
    
    if (date) {
      // Convert archived_at from UTC to CDT for date comparison
      whereConditions.push(`DATE(tb.archived_at AT TIME ZONE 'America/Chicago') = '${date}'`);
    }
    
    if (city) {
      whereConditions.push(`tb.stops::text ILIKE '%${city.replace(/'/g, "''")}%'`);
    }
    
    if (state) {
      whereConditions.push(`tb.tag = '${state.toUpperCase().replace(/'/g, "''")}'`);
    }
    
    if (milesMin) {
      whereConditions.push(`tb.distance_miles >= ${parseInt(milesMin)}`);
    }
    
    if (milesMax) {
      whereConditions.push(`tb.distance_miles <= ${parseInt(milesMax)}`);
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    // Build ORDER BY clause
    let orderBy = "ORDER BY tb.archived_at DESC";
    switch (sortBy) {
      case "distance":
        orderBy = "ORDER BY tb.distance_miles ASC";
        break;
      case "pickup":
        orderBy = "ORDER BY tb.pickup_timestamp ASC";
        break;
      case "state":
        orderBy = "ORDER BY tb.tag ASC";
        break;
      case "archived_at":
      default:
        orderBy = "ORDER BY tb.archived_at DESC";
        break;
    }

    // Query archived bids from telegram_bids (only those with archived_at set)
    const rows = await sql`
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
      ${sql.unsafe(whereClause)}
      ${sql.unsafe(orderBy)}
      LIMIT ${limit} OFFSET ${offset}
    `;

    // Get total count for pagination
    const countResult = await sql`
      SELECT COUNT(*) as total
      FROM telegram_bids tb
      WHERE tb.archived_at IS NOT NULL
      ${sql.unsafe(whereClause)}
    `;

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

    return NextResponse.json({
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

  } catch (error) {
    console.error("Error fetching archived bids:", error);
    return NextResponse.json(
      { error: "Failed to fetch archived bids" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const olderThanDays = parseInt(searchParams.get("olderThanDays") || "90");
    
    // Clean up old archived bids
    const deletedCount = await sql`
      SELECT cleanup_old_archived_bids()
    `;

    return NextResponse.json({
      ok: true,
      message: `Cleaned up archived bids older than ${olderThanDays} days`,
      deletedCount: deletedCount[0]?.cleanup_old_archived_bids || 0
    });

  } catch (error) {
    console.error("Error cleaning up archived bids:", error);
    return NextResponse.json(
      { error: "Failed to clean up archived bids" },
      { status: 500 }
    );
  }
}