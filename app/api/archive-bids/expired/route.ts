import sql from '@/lib/db';
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const city = searchParams.get("city");
    const state = searchParams.get("state");
    const tag = searchParams.get("tag");
    const milesMin = searchParams.get("milesMin");
    const milesMax = searchParams.get("milesMax");
    const sourceChannel = searchParams.get("sourceChannel");
    const sortBy = searchParams.get("sortBy") || "received_at";
    const sortOrder = searchParams.get("sortOrder") || "desc";
    const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 1000);
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build WHERE conditions
    let whereConditions = [`archived_at IS NULL`]; // Only get expired but not archived bids
    
    if (dateFrom) {
      whereConditions.push(`received_at::date >= '${dateFrom}'`);
    }
    
    if (dateTo) {
      whereConditions.push(`received_at::date <= '${dateTo}'`);
    }
    
    if (city) {
      whereConditions.push(`stops::text ILIKE '%${city.replace(/'/g, "''")}%'`);
    }
    
    if (state) {
      whereConditions.push(`tag ILIKE '%${state.replace(/'/g, "''")}%'`);
    }
    
    if (tag) {
      whereConditions.push(`tag ILIKE '%${tag.replace(/'/g, "''")}%'`);
    }
    
    if (milesMin) {
      whereConditions.push(`distance_miles >= ${parseInt(milesMin)}`);
    }
    
    if (milesMax) {
      whereConditions.push(`distance_miles <= ${parseInt(milesMax)}`);
    }
    
    if (sourceChannel) {
      whereConditions.push(`source_channel = '${sourceChannel.replace(/'/g, "''")}'`);
    }
    
    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
    
    // Build ORDER BY clause
    let orderBy = `ORDER BY ${sortBy} ${sortOrder.toUpperCase()}`;
    
    // Query to get expired bids (archived_at IS NULL)
    const rows = await sql`
      SELECT 
        tb.*,
        CASE 
          WHEN tb.tag IS NOT NULL THEN tb.tag
          ELSE 'UNKNOWN'
        END as state_tag
      FROM telegram_bids tb
      ${sql.unsafe(whereClause)}
      ${sql.unsafe(orderBy)}
      LIMIT ${limit} OFFSET ${offset}
    `;

    // Get bid counts for the returned rows
    const bidNumbers = rows.map(row => row.bid_number);
    let bidCounts = {};
    let bidAmounts = {};
    
    if (bidNumbers.length > 0) {
      const bidCountsResult = await sql`
        SELECT 
          bid_number,
          COUNT(*) as bids_count,
          MIN(amount_cents) as lowest_amount_cents,
          MAX(amount_cents) as highest_amount_cents,
          AVG(amount_cents) as avg_amount_cents
        FROM carrier_bids
        WHERE bid_number = ANY(${bidNumbers})
        GROUP BY bid_number
      `;
      
      bidCountsResult.forEach(row => {
        bidCounts[row.bid_number] = row.bids_count;
        bidAmounts[row.bid_number] = {
          lowest: row.lowest_amount_cents,
          highest: row.highest_amount_cents,
          avg: row.avg_amount_cents
        };
      });
    }

    // Add bid counts and amounts to the rows
    const enrichedRows = rows.map(row => ({
      ...row,
      bids_count: bidCounts[row.bid_number] || 0,
      lowest_bid_amount: bidAmounts[row.bid_number]?.lowest ? bidAmounts[row.bid_number].lowest / 100.0 : 0,
      highest_bid_amount: bidAmounts[row.bid_number]?.highest ? bidAmounts[row.bid_number].highest / 100.0 : 0,
      avg_bid_amount: bidAmounts[row.bid_number]?.avg ? bidAmounts[row.bid_number].avg / 100.0 : 0
    }));

    // Get total count for pagination
    const countResult = await sql`
      SELECT COUNT(*) as total
      FROM telegram_bids
      ${sql.unsafe(whereClause)}
    `;

    const total = countResult[0]?.total || 0;

    // Get comprehensive statistics
    const stats = await sql`
      SELECT 
        COUNT(*) as total_expired_bids,
        MIN(received_at::date) as earliest_date,
        MAX(received_at::date) as latest_date,
        AVG(distance_miles) as avg_distance,
        MIN(distance_miles) as min_distance,
        MAX(distance_miles) as max_distance,
        COUNT(DISTINCT CASE WHEN tag IS NOT NULL THEN tag ELSE 'UNKNOWN' END) as unique_states,
        COUNT(DISTINCT tag) as unique_tags
      FROM telegram_bids
      ${sql.unsafe(whereClause)}
    `;

    return NextResponse.json({
      ok: true,
      data: enrichedRows,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
        totalPages: Math.ceil(total / limit)
      },
      statistics: stats[0] || {},
      filters: {
        dateFrom,
        dateTo,
        city,
        state,
        tag,
        milesMin,
        milesMax,
        sourceChannel,
        sortBy,
        sortOrder
      }
    });

  } catch (error) {
    console.error("Error fetching expired bids:", error);
    return NextResponse.json(
      { error: "Failed to fetch expired bids" },
      { status: 500 }
    );
  }
}

