import sqlTemplate from '@/lib/db';
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") || undefined;
    const city = searchParams.get("city") || undefined;
    const state = searchParams.get("state") || undefined;
    const milesMin = searchParams.get("milesMin") || undefined;
    const milesMax = searchParams.get("milesMax") || undefined;
    const sortBy = searchParams.get("sortBy") || "date";
    const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build query with PostgreSQL template literals
    let whereConditions = [];
    let queryParams = [];

    if (date) {
      whereConditions.push(`archived_date = $${queryParams.length + 1}`);
      queryParams.push(date);
    }

    if (city) {
      whereConditions.push(`LOWER(stops) LIKE LOWER($${queryParams.length + 1})`);
      queryParams.push(`%${city}%`);
    }

    if (state) {
      whereConditions.push(`LOWER(tag) LIKE LOWER($${queryParams.length + 1})`);
      queryParams.push(`%${state}%`);
    }

    if (milesMin) {
      whereConditions.push(`distance_miles >= $${queryParams.length + 1}`);
      queryParams.push(parseInt(milesMin));
    }

    if (milesMax) {
      whereConditions.push(`distance_miles <= $${queryParams.length + 1}`);
      queryParams.push(parseInt(milesMax));
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    // Build ORDER BY clause
    let orderBy = 'ORDER BY archived_date DESC, received_at DESC';
    if (sortBy === 'bids') {
      orderBy = 'ORDER BY archived_date DESC, distance_miles ASC';
    }

    // Get archived bids with carrier bid counts
    const query = `
      SELECT 
        ab.*,
        CASE 
          WHEN ab.stops IS NOT NULL AND ab.stops != '' 
          THEN jsonb_array_length(ab.stops::jsonb)
          ELSE 0 
        END as stops_count,
        COALESCE(bid_counts.bids_count, 0) as bids_count,
        COALESCE(lowest_bid.amount_cents, 0) as lowest_amount_cents,
        lowest_bid.clerk_user_id as lowest_user_id
      FROM archive_bids ab
      LEFT JOIN (
        SELECT 
          bid_number,
          COUNT(*) as bids_count
        FROM carrier_bids
        GROUP BY bid_number
      ) bid_counts ON ab.bid_number = bid_counts.bid_number
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
      ) lowest_bid ON ab.bid_number = lowest_bid.bid_number
      ${whereClause}
      ${orderBy}
      LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
    `;

    const rows = await sqlTemplate(query, ...queryParams, limit, offset);

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM archive_bids ab
      ${whereClause}
    `;
    const countResult = await sqlTemplate(countQuery, ...queryParams);
    const total = parseInt(countResult[0]?.total || '0');

    // Get archive statistics by date
    const statsQuery = `
      SELECT 
        archived_date,
        COUNT(*) as bid_count,
        AVG(distance_miles) as avg_distance,
        MIN(distance_miles) as min_distance,
        MAX(distance_miles) as max_distance
      FROM archive_bids
      GROUP BY archived_date
      ORDER BY archived_date DESC
      LIMIT 30
    `;
    const stats = await sqlTemplate(statsQuery);

    return NextResponse.json({
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

  } catch (error) {
    console.error("Archived bids API error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch archived bids",
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
