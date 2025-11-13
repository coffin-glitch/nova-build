import sql from '@/lib/db';
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const bidNumber = searchParams.get("bidNumber");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const city = searchParams.get("city");
    const tag = searchParams.get("tag");
    const milesMin = searchParams.get("milesMin");
    const milesMax = searchParams.get("milesMax");
    const sourceChannel = searchParams.get("sourceChannel");
    const sortBy = searchParams.get("sortBy") || "archived_at";
    const sortOrder = searchParams.get("sortOrder") || "desc";
    const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 1000);
    const offset = parseInt(searchParams.get("offset") || "0");

    // Start with base condition (already filtered in main query)
    const whereConditionsList = [];
    
    // Add additional filters
    if (bidNumber) {
      whereConditionsList.push(`tb.bid_number ILIKE '%${bidNumber.replace(/'/g, "''")}%'`);
    }
    
    if (dateFrom) {
      // Convert archived_at from UTC to CDT for date comparison
      // archived_at stores UTC timestamp, we display in CDT
      whereConditionsList.push(`DATE(tb.archived_at AT TIME ZONE 'America/Chicago') >= '${dateFrom}'`);
    }
    
    if (dateTo) {
      // Convert archived_at from UTC to CDT for date comparison
      whereConditionsList.push(`DATE(tb.archived_at AT TIME ZONE 'America/Chicago') <= '${dateTo}'`);
    }
    
    if (city) {
      whereConditionsList.push(`tb.stops::text ILIKE '%${city.replace(/'/g, "''")}%'`);
    }
    
    if (tag) {
      whereConditionsList.push(`tb.tag ILIKE '%${tag.replace(/'/g, "''")}%'`);
    }
    
    if (milesMin) {
      whereConditionsList.push(`tb.distance_miles >= ${parseInt(milesMin)}`);
    }
    
    if (milesMax) {
      whereConditionsList.push(`tb.distance_miles <= ${parseInt(milesMax)}`);
    }
    
    if (sourceChannel) {
      whereConditionsList.push(`tb.source_channel = '${sourceChannel.replace(/'/g, "''")}'`);
    }
    
    // Build ORDER BY clause - bids_count must be sorted in-memory
    let orderBy;
    if (sortBy !== 'bids_count') {
      orderBy = sql.unsafe(`ORDER BY tb.${sortBy} ${sortOrder.toUpperCase()}`);
    } else {
      orderBy = sql.unsafe(`ORDER BY tb.archived_at DESC`); // Default ordering before in-memory sort
    }
    
    // Query to get archived bids (only those with archived_at set)
    // If we want expired bids (archived_at IS NULL), use expired_bids view
    const wherePart = whereConditionsList.length > 0 
      ? `AND ${whereConditionsList.join(' AND ')}` 
      : '';
    
    const rows = await sql`
      SELECT 
        tb.*,
        CASE 
          WHEN tb.tag IS NOT NULL THEN tb.tag
          ELSE 'UNKNOWN'
        END as state_tag
      FROM telegram_bids tb
      WHERE tb.archived_at IS NOT NULL ${sql.unsafe(wherePart)}
      ${orderBy}
      LIMIT ${limit} OFFSET ${offset}
    `;

    // Get bid counts for the returned rows
    const bidNumbers = rows.map(row => row.bid_number);
    let bidCounts: Record<string, number> = {};
    let bidAmounts: Record<string, { lowest: number | null; highest: number | null; avg: number | null }> = {};
    
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
      
      bidCountsResult.forEach((row: any) => {
        bidCounts[row.bid_number] = row.bids_count;
        bidAmounts[row.bid_number] = {
          lowest: row.lowest_amount_cents,
          highest: row.highest_amount_cents,
          avg: row.avg_amount_cents
        };
      });
    }

    // Add bid counts and amounts to the rows
    let enrichedRows = rows.map(row => ({
      ...row,
      bids_count: bidCounts[row.bid_number] || 0,
      lowest_bid_amount: bidAmounts[row.bid_number]?.lowest ? (bidAmounts[row.bid_number]!.lowest || 0) / 100.0 : 0,
      highest_bid_amount: bidAmounts[row.bid_number]?.highest ? (bidAmounts[row.bid_number]!.highest || 0) / 100.0 : 0,
      avg_bid_amount: bidAmounts[row.bid_number]?.avg ? (bidAmounts[row.bid_number]!.avg || 0) / 100.0 : 0
    }));
    
    // If sorting by bids_count, sort in-memory
    if (sortBy === 'bids_count') {
      enrichedRows.sort((a, b) => {
        const aVal = a.bids_count || 0;
        const bVal = b.bids_count || 0;
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      });
    }

    // Get total count for pagination
    const countResult = await sql`
      SELECT COUNT(*) as total
      FROM telegram_bids tb
      WHERE tb.archived_at IS NOT NULL ${sql.unsafe(wherePart)}
    `;

    const total = countResult[0]?.total || 0;

    // Get comprehensive statistics
    // Convert archived_at from UTC to CDT for date comparisons
    const stats = await sql`
      SELECT 
        COUNT(*) as total_bids,
        COUNT(DISTINCT DATE(archived_at AT TIME ZONE 'America/Chicago')) as archive_days,
        MIN(DATE(archived_at AT TIME ZONE 'America/Chicago')) as earliest_date,
        MAX(DATE(archived_at AT TIME ZONE 'America/Chicago')) as latest_date,
        AVG(distance_miles) as avg_distance,
        MIN(distance_miles) as min_distance,
        MAX(distance_miles) as max_distance,
        COUNT(DISTINCT CASE WHEN tag IS NOT NULL THEN tag ELSE 'UNKNOWN' END) as unique_states,
        COUNT(DISTINCT tag) as unique_tags
      FROM telegram_bids tb
      WHERE tb.archived_at IS NOT NULL ${sql.unsafe(wherePart)}
    `;

    // Get archive activity by day
    // Convert archived_at from UTC to CDT for grouping
    const dailyActivity = await sql`
      SELECT 
        DATE(archived_at AT TIME ZONE 'America/Chicago') as archive_date,
        COUNT(*) as bids_archived,
        MIN(archived_at::time) as first_archive_time,
        MAX(archived_at::time) as last_archive_time
      FROM telegram_bids tb
      WHERE tb.archived_at IS NOT NULL ${sql.unsafe(wherePart)}
      GROUP BY DATE(archived_at AT TIME ZONE 'America/Chicago')
      ORDER BY archive_date DESC
      LIMIT 30
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
      dailyActivity: dailyActivity || [],
      filters: {
        bidNumber,
        dateFrom,
        dateTo,
        city,
        tag,
        milesMin,
        milesMax,
        sourceChannel,
        sortBy,
        sortOrder
      }
    });

  } catch (error) {
    console.error("Error fetching archive bids history:", error);
    return NextResponse.json(
      { error: "Failed to fetch archive bids history" },
      { status: 500 }
    );
  }
}