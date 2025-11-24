import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from '@/lib/db';
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // Require admin authentication for archive access
    const auth = await requireApiAdmin(request);
    const userId = auth.userId;

    // Check rate limit for admin read operation (search can be resource-intensive)
    const rateLimit = await checkApiRateLimit(request, {
      userId,
      routeType: 'search'
    });

    if (!rateLimit.allowed) {
      const response = NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: `Too many requests. Please try again after ${rateLimit.retryAfter} seconds.`,
          retryAfter: rateLimit.retryAfter
        },
        { status: 429 }
      );
      return addRateLimitHeaders(addSecurityHeaders(response), rateLimit);
    }
    
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

    // Input validation
    const validation = validateInput(
      { bidNumber, dateFrom, dateTo, city, tag, milesMin, milesMax, sourceChannel, sortBy, sortOrder, limit, offset },
      {
        bidNumber: { type: 'string', maxLength: 100, required: false },
        dateFrom: { type: 'string', pattern: /^\d{4}-\d{2}-\d{2}$/, maxLength: 10, required: false },
        dateTo: { type: 'string', pattern: /^\d{4}-\d{2}-\d{2}$/, maxLength: 10, required: false },
        city: { type: 'string', maxLength: 100, required: false },
        tag: { type: 'string', maxLength: 100, required: false },
        milesMin: { type: 'string', pattern: /^\d+$/, maxLength: 10, required: false },
        milesMax: { type: 'string', pattern: /^\d+$/, maxLength: 10, required: false },
        sourceChannel: { type: 'string', maxLength: 50, required: false },
        sortBy: { type: 'string', enum: ['archived_at', 'received_at', 'distance_miles', 'bids_count'], required: false },
        sortOrder: { type: 'string', enum: ['asc', 'desc'], required: false },
        limit: { type: 'number', min: 1, max: 1000 },
        offset: { type: 'number', min: 0 }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_archive_history_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // Build query using parameterized queries (fixes SQL injection)
    // Use conditional WHERE clauses with sql template literals
    // Validate and sanitize sortBy - only allow safe column names
    const validSortBy = ['archived_at', 'received_at', 'distance_miles'].includes(sortBy) ? sortBy : 'archived_at';
    const validSortOrder = sortOrder === 'asc' ? 'ASC' : 'DESC';
    
    // Build ORDER BY clause safely - use sql.unsafe only for validated column names
    const orderByClause = sql.unsafe(`ORDER BY tb.${validSortBy} ${validSortOrder}`);
    
    const rows = await sql`
      SELECT 
        tb.*,
        CASE 
          WHEN tb.tag IS NOT NULL THEN tb.tag
          ELSE 'UNKNOWN'
        END as state_tag
      FROM telegram_bids tb
      WHERE tb.archived_at IS NOT NULL
        ${bidNumber ? sql`AND tb.bid_number ILIKE ${'%' + bidNumber + '%'}` : sql``}
        ${dateFrom ? sql`AND DATE(tb.archived_at AT TIME ZONE 'America/Chicago') >= ${dateFrom}::date` : sql``}
        ${dateTo ? sql`AND DATE(tb.archived_at AT TIME ZONE 'America/Chicago') <= ${dateTo}::date` : sql``}
        ${city ? sql`AND tb.stops::text ILIKE ${'%' + city + '%'}` : sql``}
        ${tag ? sql`AND tb.tag ILIKE ${'%' + tag + '%'}` : sql``}
        ${milesMin ? sql`AND tb.distance_miles >= ${parseInt(milesMin)}` : sql``}
        ${milesMax ? sql`AND tb.distance_miles <= ${parseInt(milesMax)}` : sql``}
        ${sourceChannel ? sql`AND tb.source_channel = ${sourceChannel}` : sql``}
      ${orderByClause}
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
      WHERE tb.archived_at IS NOT NULL
        ${bidNumber ? sql`AND tb.bid_number ILIKE ${'%' + bidNumber + '%'}` : sql``}
        ${dateFrom ? sql`AND DATE(tb.archived_at AT TIME ZONE 'America/Chicago') >= ${dateFrom}::date` : sql``}
        ${dateTo ? sql`AND DATE(tb.archived_at AT TIME ZONE 'America/Chicago') <= ${dateTo}::date` : sql``}
        ${city ? sql`AND tb.stops::text ILIKE ${'%' + city + '%'}` : sql``}
        ${tag ? sql`AND tb.tag ILIKE ${'%' + tag + '%'}` : sql``}
        ${milesMin ? sql`AND tb.distance_miles >= ${parseInt(milesMin)}` : sql``}
        ${milesMax ? sql`AND tb.distance_miles <= ${parseInt(milesMax)}` : sql``}
        ${sourceChannel ? sql`AND tb.source_channel = ${sourceChannel}` : sql``}
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
      WHERE tb.archived_at IS NOT NULL
        ${bidNumber ? sql`AND tb.bid_number ILIKE ${'%' + bidNumber + '%'}` : sql``}
        ${dateFrom ? sql`AND DATE(tb.archived_at AT TIME ZONE 'America/Chicago') >= ${dateFrom}::date` : sql``}
        ${dateTo ? sql`AND DATE(tb.archived_at AT TIME ZONE 'America/Chicago') <= ${dateTo}::date` : sql``}
        ${city ? sql`AND tb.stops::text ILIKE ${'%' + city + '%'}` : sql``}
        ${tag ? sql`AND tb.tag ILIKE ${'%' + tag + '%'}` : sql``}
        ${milesMin ? sql`AND tb.distance_miles >= ${parseInt(milesMin)}` : sql``}
        ${milesMax ? sql`AND tb.distance_miles <= ${parseInt(milesMax)}` : sql``}
        ${sourceChannel ? sql`AND tb.source_channel = ${sourceChannel}` : sql``}
    `;

    // Get archive activity by day - UNFILTERED totals for each day
    // This shows the total archived bids per day regardless of current filters
    // Convert archived_at from UTC to CDT for grouping
    const dailyActivity = await sql`
      SELECT 
        DATE(archived_at AT TIME ZONE 'America/Chicago') as archive_date,
        COUNT(*) as bids_archived,
        MIN(archived_at::time) as first_archive_time,
        MAX(archived_at::time) as last_archive_time
      FROM telegram_bids tb
      WHERE tb.archived_at IS NOT NULL
      GROUP BY DATE(archived_at AT TIME ZONE 'America/Chicago')
      ORDER BY archive_date DESC
      LIMIT 30
    `;

    logSecurityEvent('archive_bids_history_accessed', userId, { 
      filters: { bidNumber, dateFrom, dateTo, city, tag, milesMin, milesMax, sourceChannel, sortBy, sortOrder }
    });
    
    const response = NextResponse.json({
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
    
    return addSecurityHeaders(response);

  } catch (error: any) {
    console.error("Error fetching archive bids history:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('archive_bids_history_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to fetch archive bids history",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}