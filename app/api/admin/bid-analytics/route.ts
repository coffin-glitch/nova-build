import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // Ensure user is admin (Supabase-only)
    const auth = await requireApiAdmin(request);
    const userId = auth.userId;

    const { searchParams } = new URL(request.url);
    const timeframe = searchParams.get("timeframe") || "30"; // days
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");
    const action = searchParams.get("action") || "overview";
    const hourlyTimeframe = searchParams.get("hourlyTimeframe") || "today"; // for hourly trends

    // Input validation
    const validation = validateInput(
      { timeframe, startDateParam, endDateParam, action, hourlyTimeframe },
      {
        timeframe: { type: 'string', maxLength: 50, required: false },
        startDateParam: { type: 'string', pattern: /^\d{4}-\d{2}-\d{2}$/, required: false },
        endDateParam: { type: 'string', pattern: /^\d{4}-\d{2}-\d{2}$/, required: false },
        action: { type: 'string', enum: ['overview', 'trends', 'performance', 'carrier_activity', 'auction_insights'], required: false },
        hourlyTimeframe: { type: 'string', maxLength: 50, required: false }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_bid_analytics_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { success: false, error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // Calculate date range - support custom date range, "today", "all", or numeric days
    let startDate: Date;
    let endDate: Date | null = null;
    
    if (startDateParam && endDateParam) {
      // Custom date range
      startDate = new Date(startDateParam);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(endDateParam);
      endDate.setHours(23, 59, 59, 999);
    } else if (timeframe === "today") {
      // Today only
      startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date();
      endDate.setHours(23, 59, 59, 999);
    } else if (timeframe === "all") {
      // Set a very early date for "all time" - using year 2000 as a safe early date
      startDate = new Date('2000-01-01T00:00:00.000Z');
    } else {
      const daysAgo = parseInt(timeframe);
      startDate = new Date();
      startDate.setDate(startDate.getDate() - daysAgo);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date();
      endDate.setHours(23, 59, 59, 999);
    }

    switch (action) {
      case "overview":
        return await getBidOverview(startDate, endDate);
      case "trends":
        return await getBidTrends(startDate, hourlyTimeframe, endDate);
      case "performance":
        return await getPerformanceMetrics(startDate, endDate);
      case "carrier_activity":
        return await getCarrierActivity(startDate, endDate);
      case "auction_insights":
        return await getAuctionInsights(startDate, endDate);
      default:
        return await getBidOverview(startDate, endDate);
    }

  } catch (error: any) {
    console.error("Bid analytics API error:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('bid_analytics_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        success: false,
        error: "Failed to fetch bid analytics",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}

async function getBidOverview(startDate: Date, endDate: Date | null = null) {
  // Get comprehensive bid overview statistics
  const dateFilter = endDate 
    ? sql`tb.received_at >= ${startDate.toISOString()} AND tb.received_at <= ${endDate.toISOString()}`
    : sql`tb.received_at >= ${startDate.toISOString()}`;
  const bidDateFilter = endDate
    ? sql`cb.created_at >= ${startDate.toISOString()} AND cb.created_at <= ${endDate.toISOString()}`
    : sql`cb.created_at >= ${startDate.toISOString()}`;
  
  const overview = await sql`
    WITH bid_stats AS (
      SELECT 
        COUNT(tb.id) as total_auctions,
        COUNT(CASE WHEN NOW() <= (tb.received_at::timestamp + INTERVAL '25 minutes') THEN 1 END) as active_auctions,
        COUNT(CASE WHEN NOW() > (tb.received_at::timestamp + INTERVAL '25 minutes') THEN 1 END) as expired_auctions,
        COUNT(CASE 
          ${endDate ? sql`WHEN tb.received_at >= ${startDate.toISOString()} AND tb.received_at <= ${endDate.toISOString()} THEN 1` : startDate ? sql`WHEN tb.received_at >= ${startDate.toISOString()} THEN 1` : sql`WHEN 1=1 THEN 1`}
        END) as recent_auctions,
        
        -- Today's specific counts
        COUNT(CASE WHEN tb.received_at::date = CURRENT_DATE THEN 1 END) as total_auctions_today,
        COUNT(CASE WHEN tb.received_at::date = CURRENT_DATE AND NOW() <= (tb.received_at::timestamp + INTERVAL '25 minutes') THEN 1 END) as active_auctions_today,
        COUNT(CASE WHEN tb.received_at::date = CURRENT_DATE AND NOW() > (tb.received_at::timestamp + INTERVAL '25 minutes') THEN 1 END) as expired_auctions_today,
        
        COUNT(cb.id) as total_carrier_bids,
        COUNT(CASE 
          ${endDate ? sql`WHEN cb.created_at >= ${startDate.toISOString()} AND cb.created_at <= ${endDate.toISOString()} THEN 1` : startDate ? sql`WHEN cb.created_at >= ${startDate.toISOString()} THEN 1` : sql`WHEN 1=1 THEN 1`}
        END) as recent_carrier_bids,
        COUNT(CASE WHEN cb.created_at::date = CURRENT_DATE THEN 1 END) as total_carrier_bids_today,
        
        COUNT(DISTINCT cb.supabase_user_id) as unique_carriers_bid,
        COUNT(DISTINCT CASE 
          ${endDate ? sql`WHEN cb.created_at >= ${startDate.toISOString()} AND cb.created_at <= ${endDate.toISOString()} THEN cb.supabase_user_id` : startDate ? sql`WHEN cb.created_at >= ${startDate.toISOString()} THEN cb.supabase_user_id` : sql`WHEN 1=1 THEN cb.supabase_user_id`}
        END) as recent_carriers_bid,
        
        COALESCE(AVG(cb.amount_cents), 0) as avg_bid_amount,
        COALESCE(MIN(cb.amount_cents), 0) as min_bid_amount,
        COALESCE(MAX(cb.amount_cents), 0) as max_bid_amount,
        
        COALESCE(AVG(tb.distance_miles), 0) as avg_distance,
        COALESCE(MIN(tb.distance_miles), 0) as min_distance,
        COALESCE(MAX(tb.distance_miles), 0) as max_distance
      FROM telegram_bids tb
      LEFT JOIN carrier_bids cb ON tb.bid_number = cb.bid_number
      ${endDate ? sql`WHERE ${dateFilter} AND (cb.id IS NULL OR ${bidDateFilter})` : startDate ? sql`WHERE ${dateFilter} AND (cb.id IS NULL OR ${bidDateFilter})` : sql``}
    ),
    
    winning_stats AS (
      SELECT 
        COUNT(aa.id) as total_wins,
        COALESCE(AVG(aa.winner_amount_cents), 0) as avg_winning_bid,
        COALESCE(SUM(aa.winner_amount_cents), 0) as total_winnings_value
      FROM auction_awards aa
      INNER JOIN telegram_bids tb ON aa.bid_number = tb.bid_number
      ${endDate ? sql`WHERE aa.awarded_at >= ${startDate.toISOString()} AND aa.awarded_at <= ${endDate.toISOString()}` : startDate ? sql`WHERE aa.awarded_at >= ${startDate.toISOString()}` : sql``}
    ),
    
    competition_stats AS (
      SELECT 
        AVG(bid_counts.bids_count) as avg_bids_per_auction,
        MAX(bid_counts.bids_count) as max_bids_per_auction,
        COUNT(CASE WHEN bid_counts.bids_count = 1 THEN 1 END) as single_bid_auctions,
        COUNT(CASE WHEN bid_counts.bids_count > 5 THEN 1 END) as competitive_auctions
      FROM (
        SELECT 
          bid_number,
          COUNT(*) as bids_count
        FROM carrier_bids
        ${endDate ? sql`WHERE created_at >= ${startDate.toISOString()} AND created_at <= ${endDate.toISOString()}` : startDate ? sql`WHERE created_at >= ${startDate.toISOString()}` : sql``}
        GROUP BY bid_number
      ) bid_counts
    )
    
    SELECT 
      bs.*,
      ws.total_wins,
      ws.avg_winning_bid,
      ws.total_winnings_value,
      cs.avg_bids_per_auction,
      cs.max_bids_per_auction,
      cs.single_bid_auctions,
      cs.competitive_auctions,
      
      -- Calculated metrics
      CASE 
        WHEN bs.total_auctions > 0 THEN ROUND((ws.total_wins::DECIMAL / bs.total_auctions * 100), 2)
        ELSE 0 
      END as win_rate_percentage,
      
      CASE 
        WHEN bs.total_auctions > 0 THEN ROUND((bs.total_carrier_bids::DECIMAL / NULLIF(bs.total_auctions, 0)), 2)
        ELSE 0 
      END as avg_bids_per_auction_calc
      
    FROM bid_stats bs
    CROSS JOIN winning_stats ws
    CROSS JOIN competition_stats cs
  `;

  const response = NextResponse.json({
    success: true,
    data: {
      overview: overview[0] || {},
      timeframe: {
        days: endDate 
          ? Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
          : Math.floor((new Date().getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)),
        startDate: startDate.toISOString(),
        endDate: endDate ? endDate.toISOString() : new Date().toISOString()
      }
    }
  });
  
  return addSecurityHeaders(response);
}

// Helper function to calculate date range for hourly trends
function getHourlyTrendsDateRange(timeframe: string): { startDate: Date; endDate: Date } {
  const now = new Date();
  const startDate = new Date();
  const endDate = new Date();
  
  switch (timeframe) {
    case "today":
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      break;
    case "yesterday":
      startDate.setDate(startDate.getDate() - 1);
      startDate.setHours(0, 0, 0, 0);
      endDate.setDate(endDate.getDate() - 1);
      endDate.setHours(23, 59, 59, 999);
      break;
    case "this_week":
      const dayOfWeek = now.getDay();
      startDate.setDate(now.getDate() - dayOfWeek);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      break;
    case "last_week":
      const lastWeekStart = new Date(now);
      lastWeekStart.setDate(now.getDate() - now.getDay() - 7);
      lastWeekStart.setHours(0, 0, 0, 0);
      const lastWeekEnd = new Date(lastWeekStart);
      lastWeekEnd.setDate(lastWeekStart.getDate() + 6);
      lastWeekEnd.setHours(23, 59, 59, 999);
      startDate.setTime(lastWeekStart.getTime());
      endDate.setTime(lastWeekEnd.getTime());
      break;
    case "this_month":
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      break;
    case "last_month":
      startDate.setMonth(now.getMonth() - 1);
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);
      endDate.setMonth(now.getMonth());
      endDate.setDate(0);
      endDate.setHours(23, 59, 59, 999);
      break;
    case "last_3_months":
      startDate.setMonth(now.getMonth() - 3);
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      break;
    case "this_year":
      startDate.setMonth(0, 1);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      break;
    case "last_year":
      startDate.setFullYear(now.getFullYear() - 1);
      startDate.setMonth(0, 1);
      startDate.setHours(0, 0, 0, 0);
      endDate.setFullYear(now.getFullYear() - 1);
      endDate.setMonth(11, 31);
      endDate.setHours(23, 59, 59, 999);
      break;
    case "all_time":
      startDate.setFullYear(2020, 0, 1);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      break;
    default:
      // Default to today
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
  }
  
  return { startDate, endDate };
}

async function getBidTrends(startDate: Date, hourlyTimeframe: string = "today", endDate: Date | null = null) {
  // Get daily bid trends (filtered by date range when endDate is provided)
  const dailyTrends = await sql`
    SELECT 
      DATE(tb.received_at) as date,
      COUNT(tb.id) as auctions_created,
      COUNT(cb.id) as bids_placed,
      COUNT(DISTINCT cb.supabase_user_id) as unique_carriers,
      COALESCE(AVG(cb.amount_cents), 0) as avg_bid_amount,
      COALESCE(AVG(tb.distance_miles), 0) as avg_distance
    FROM telegram_bids tb
    LEFT JOIN carrier_bids cb ON tb.bid_number = cb.bid_number
    WHERE tb.received_at >= ${startDate.toISOString()}
      ${endDate ? sql`AND tb.received_at <= ${endDate.toISOString()}` : sql``}
    GROUP BY DATE(tb.received_at)
    ORDER BY date DESC
    LIMIT 30
  `;

  // Get hourly trends based on timeframe
  const { startDate: hourlyStartDate, endDate: hourlyEndDate } = getHourlyTrendsDateRange(hourlyTimeframe);
  const hourlyTrends = await sql`
    SELECT 
      EXTRACT(HOUR FROM tb.received_at) as hour,
      COUNT(tb.id) as auctions_created,
      COUNT(cb.id) as bids_placed
    FROM telegram_bids tb
    LEFT JOIN carrier_bids cb ON tb.bid_number = cb.bid_number
    WHERE tb.received_at >= ${hourlyStartDate.toISOString()}
      AND tb.received_at <= ${hourlyEndDate.toISOString()}
    GROUP BY EXTRACT(HOUR FROM tb.received_at)
    ORDER BY hour
  `;

  const response = NextResponse.json({
    success: true,
    data: {
      dailyTrends,
      hourlyTrends,
      timeframe: {
        days: endDate 
          ? Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
          : Math.floor((new Date().getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)),
        startDate: startDate.toISOString(),
        endDate: endDate ? endDate.toISOString() : new Date().toISOString()
      }
    }
  });
  
  return addSecurityHeaders(response);
}

async function getPerformanceMetrics(startDate: Date, endDate: Date | null = null) {
  // Get performance metrics by different dimensions
  const dateFilter = endDate 
    ? sql`tb.received_at >= ${startDate.toISOString()} AND tb.received_at <= ${endDate.toISOString()}`
    : sql`tb.received_at >= ${startDate.toISOString()}`;
  
  const distancePerformance = await sql`
    SELECT 
      CASE 
        WHEN tb.distance_miles < 100 THEN 'Short (<100mi)'
        WHEN tb.distance_miles < 500 THEN 'Medium (100-500mi)'
        WHEN tb.distance_miles < 1000 THEN 'Long (500-1000mi)'
        ELSE 'Very Long (1000mi+)'
      END as distance_category,
      COUNT(tb.id) as auction_count,
      COUNT(cb.id) as bid_count,
      COUNT(DISTINCT cb.supabase_user_id) as unique_carriers,
      COALESCE(AVG(cb.amount_cents), 0) as avg_bid_amount,
      COALESCE(AVG(tb.distance_miles), 0) as avg_distance
    FROM telegram_bids tb
    LEFT JOIN carrier_bids cb ON tb.bid_number = cb.bid_number
    WHERE ${dateFilter}
    GROUP BY distance_category
    ORDER BY avg_distance
  `;

  const tagPerformance = await sql`
    SELECT 
      COALESCE(tb.tag, 'No Tag') as tag,
      COUNT(tb.id) as auction_count,
      COUNT(cb.id) as bid_count,
      COUNT(DISTINCT cb.supabase_user_id) as unique_carriers,
      COALESCE(AVG(cb.amount_cents), 0) as avg_bid_amount
    FROM telegram_bids tb
    LEFT JOIN carrier_bids cb ON tb.bid_number = cb.bid_number
    WHERE ${dateFilter}
    GROUP BY tb.tag
    ORDER BY auction_count DESC
    LIMIT 100
  `;

  const timePerformance = await sql`
    SELECT 
      CASE 
        WHEN EXTRACT(HOUR FROM tb.received_at) BETWEEN 6 AND 11 THEN 'Morning (6-11)'
        WHEN EXTRACT(HOUR FROM tb.received_at) BETWEEN 12 AND 17 THEN 'Afternoon (12-17)'
        WHEN EXTRACT(HOUR FROM tb.received_at) BETWEEN 18 AND 23 THEN 'Evening (18-23)'
        ELSE 'Night (0-5)'
      END as time_category,
      COUNT(tb.id) as auction_count,
      COUNT(cb.id) as bid_count,
      COUNT(DISTINCT cb.supabase_user_id) as unique_carriers,
      COALESCE(AVG(cb.amount_cents), 0) as avg_bid_amount
    FROM telegram_bids tb
    LEFT JOIN carrier_bids cb ON tb.bid_number = cb.bid_number
    WHERE ${dateFilter}
    GROUP BY time_category
    ORDER BY auction_count DESC
  `;

  const response = NextResponse.json({
    success: true,
    data: {
      distancePerformance,
      tagPerformance,
      timePerformance,
      timeframe: {
        days: endDate 
          ? Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
          : Math.floor((new Date().getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)),
        startDate: startDate.toISOString(),
        endDate: endDate ? endDate.toISOString() : new Date().toISOString()
      }
    }
  });
  
  return addSecurityHeaders(response);
}

async function getCarrierActivity(startDate: Date, endDate: Date | null = null) {
  // Get carrier activity patterns
  const dateFilter = endDate
    ? sql`cb.created_at >= ${startDate.toISOString()} AND cb.created_at <= ${endDate.toISOString()}`
    : sql`cb.created_at >= ${startDate.toISOString()}`;
  
  const activityPatterns = await sql`
    SELECT 
      cp.company_name,
      cp.legal_name,
      cp.mc_number,
      COUNT(cb.id) as total_bids,
      COUNT(CASE WHEN ${dateFilter} THEN 1 END) as recent_bids,
      MIN(cb.created_at) as first_bid_at,
      MAX(cb.created_at) as last_bid_at,
      COALESCE(AVG(cb.amount_cents), 0) as avg_bid_amount,
      COUNT(aa.id) as winning_bids,
      
      -- Activity metrics
      COUNT(DISTINCT DATE(cb.created_at)) as active_days,
      COUNT(DISTINCT cb.bid_number) as unique_auctions_participated,
      
      -- Time-based activity
      COUNT(CASE WHEN EXTRACT(HOUR FROM cb.created_at) BETWEEN 6 AND 11 THEN 1 END) as morning_bids,
      COUNT(CASE WHEN EXTRACT(HOUR FROM cb.created_at) BETWEEN 12 AND 17 THEN 1 END) as afternoon_bids,
      COUNT(CASE WHEN EXTRACT(HOUR FROM cb.created_at) BETWEEN 18 AND 23 THEN 1 END) as evening_bids,
      COUNT(CASE WHEN EXTRACT(HOUR FROM cb.created_at) BETWEEN 0 AND 5 THEN 1 END) as night_bids
      
    FROM carrier_profiles cp
    INNER JOIN carrier_bids cb ON cp.supabase_user_id = cb.supabase_user_id
    LEFT JOIN auction_awards aa ON aa.bid_number = cb.bid_number 
      AND aa.supabase_winner_user_id = cp.supabase_user_id
    WHERE ${dateFilter}
    GROUP BY cp.supabase_user_id, cp.company_name, cp.legal_name, cp.mc_number
    ORDER BY recent_bids DESC
    LIMIT 50
  `;

  const response = NextResponse.json({
    success: true,
    data: {
      activityPatterns,
      timeframe: {
        days: endDate 
          ? Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
          : Math.floor((new Date().getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)),
        startDate: startDate.toISOString(),
        endDate: endDate ? endDate.toISOString() : new Date().toISOString()
      }
    }
  });
  
  return addSecurityHeaders(response);
}

async function getAuctionInsights(startDate: Date, endDate: Date | null = null) {
  // Enhanced auction insights with new metrics
  const dateFilter = endDate
    ? sql`tb.received_at >= ${startDate.toISOString()} AND tb.received_at <= ${endDate.toISOString()}`
    : sql`tb.received_at >= ${startDate.toISOString()}`;
  // Note: bidDateFilter doesn't use table alias since it's used in contexts where the table name varies
  const bidDateFilter = endDate
    ? sql`created_at >= ${startDate.toISOString()} AND created_at <= ${endDate.toISOString()}`
    : sql`created_at >= ${startDate.toISOString()}`;
  
  // Build WHERE clause for bid_timing CTE to avoid nested sql templates
  // Combine both dateFilter conditions into a single sql template
  const bidTimingWhereClause = endDate
    ? sql`tb.received_at >= ${startDate.toISOString()} AND tb.received_at <= ${endDate.toISOString()} AND cb.created_at >= ${startDate.toISOString()} AND cb.created_at <= ${endDate.toISOString()}`
    : sql`tb.received_at >= ${startDate.toISOString()} AND cb.created_at >= ${startDate.toISOString()}`;
  
  // Debug logging
  if (process.env.NODE_ENV === 'development') {
    console.log('[Auction Insights] Date Range:', {
      startDate: startDate.toISOString(),
      endDate: endDate?.toISOString() || 'null',
    });
  }
  
  const auctionInsights = await sql`
    WITH auction_competition AS (
      SELECT 
        tb.bid_number,
        tb.distance_miles,
        tb.tag,
        tb.received_at,
        tb.pickup_timestamp,
        COUNT(cb.id) as bid_count,
        COALESCE(MIN(cb.amount_cents), 0) as winning_bid_amount,
        COALESCE(MAX(cb.amount_cents), 0) as highest_bid_amount,
        COALESCE(AVG(cb.amount_cents), 0) as avg_bid_amount,
        COUNT(DISTINCT cb.supabase_user_id) as unique_carriers,
        MIN(cb.created_at) as first_bid_at,
        MAX(cb.created_at) as last_bid_at,
        (NOW() > (tb.received_at::timestamp + INTERVAL '25 minutes')) as is_expired,
        EXTRACT(EPOCH FROM (MIN(cb.created_at) - tb.received_at)) / 60 as minutes_to_first_bid
      FROM telegram_bids tb
      LEFT JOIN carrier_bids cb ON tb.bid_number = cb.bid_number
      WHERE ${dateFilter}
      GROUP BY tb.bid_number, tb.distance_miles, tb.tag, tb.received_at, tb.pickup_timestamp
    ),
    
    auction_outcomes AS (
      SELECT 
        ac.bid_number,
        ac.bid_count,
        ac.is_expired,
        ac.first_bid_at,
        CASE 
          WHEN aa.id IS NOT NULL AND aa.supabase_winner_user_id IS NULL THEN 'no_contest'
          WHEN aa.id IS NOT NULL AND aa.supabase_winner_user_id IS NOT NULL THEN 'awarded'
          WHEN ac.is_expired AND ac.bid_count > 0 THEN 'expired_with_bids'
          WHEN ac.is_expired AND ac.bid_count = 0 THEN 'expired_no_bids'
          ELSE 'pending'
        END as outcome,
        aa.awarded_at,
        CASE 
          WHEN aa.awarded_at IS NOT NULL AND ac.first_bid_at IS NOT NULL 
          THEN EXTRACT(EPOCH FROM (aa.awarded_at - ac.first_bid_at)) / 60
          ELSE NULL
        END as minutes_to_award,
        cb.status
      FROM auction_competition ac
      LEFT JOIN auction_awards aa ON ac.bid_number = aa.bid_number
      LEFT JOIN carrier_bids cb ON aa.bid_number = cb.bid_number 
        AND aa.supabase_winner_user_id = cb.supabase_user_id
    ),
    
    bid_timing AS (
      SELECT 
        EXTRACT(HOUR FROM cb.created_at) as bid_hour,
        COUNT(*) as bid_count
      FROM carrier_bids cb
      INNER JOIN telegram_bids tb ON cb.bid_number = tb.bid_number
      WHERE ${bidTimingWhereClause}
      GROUP BY EXTRACT(HOUR FROM cb.created_at)
    ),
    
    bid_revisions AS (
      SELECT 
        bid_number,
        supabase_user_id,
        COUNT(*) as revision_count
      FROM carrier_bids
      WHERE ${bidDateFilter}
      GROUP BY bid_number, supabase_user_id
      HAVING COUNT(*) > 1
    )
    
    SELECT 
      -- Basic competition metrics
      COUNT(*) as total_auctions,
      COUNT(CASE WHEN ac.bid_count = 0 THEN 1 END) as no_bid_auctions,
      COUNT(CASE WHEN ac.bid_count = 1 THEN 1 END) as single_bid_auctions,
      COUNT(CASE WHEN ac.bid_count BETWEEN 2 AND 5 THEN 1 END) as moderate_competition_auctions,
      COUNT(CASE WHEN ac.bid_count > 5 THEN 1 END) as high_competition_auctions,
      
      COALESCE(AVG(ac.bid_count), 0) as avg_bids_per_auction,
      COALESCE(MAX(ac.bid_count), 0) as max_bids_per_auction,
      
      COALESCE(AVG(ac.winning_bid_amount), 0) as avg_winning_bid,
      COALESCE(AVG(ac.highest_bid_amount), 0) as avg_highest_bid,
      COALESCE(AVG(ac.avg_bid_amount), 0) as avg_bid_amount_overall,
      
      COALESCE(AVG(ac.distance_miles), 0) as avg_distance,
      COALESCE(AVG(ac.highest_bid_amount - ac.winning_bid_amount), 0) as avg_bid_spread,
      
      -- NEW: Bid timing metrics
      COALESCE(AVG(ac.minutes_to_first_bid), 0) as avg_minutes_to_first_bid,
      COALESCE(MIN(ac.minutes_to_first_bid), 0) as fastest_first_bid_minutes,
      COALESCE(MAX(ac.minutes_to_first_bid), 0) as slowest_first_bid_minutes,
      
      -- NEW: Award metrics
      COUNT(CASE WHEN ao.outcome = 'awarded' THEN 1 END) as awarded_count,
      COUNT(CASE WHEN ao.outcome = 'no_contest' THEN 1 END) as no_contest_count,
      COUNT(CASE WHEN ao.outcome = 'expired_with_bids' THEN 1 END) as expired_with_bids_count,
      COUNT(CASE WHEN ao.outcome = 'pending' THEN 1 END) as pending_count,
      COALESCE(AVG(ao.minutes_to_award), 0) as avg_minutes_to_award,
      
      -- NEW: Acceptance metrics
      COUNT(CASE WHEN ao.outcome = 'awarded' AND ao.status = 'bid_awarded' THEN 1 END) as accepted_count,
      COUNT(CASE WHEN ao.outcome = 'awarded' AND ao.status = 'awarded' THEN 1 END) as pending_acceptance_count,
      
      -- NEW: Engagement depth
      COALESCE(AVG(ac.bid_count::DECIMAL / NULLIF(ac.unique_carriers, 0)), 0) as avg_bids_per_carrier,
      
      -- NEW: Price discovery efficiency (how quickly prices converge)
      COALESCE(AVG(
        CASE 
          WHEN ac.bid_count > 1 AND (ac.highest_bid_amount - ac.winning_bid_amount) > 0
          THEN (ac.highest_bid_amount - ac.winning_bid_amount) / NULLIF(ac.highest_bid_amount, 0) * 100
          ELSE 0
        END
      ), 0) as avg_price_spread_percentage
      
    FROM auction_competition ac
    LEFT JOIN auction_outcomes ao ON ac.bid_number = ao.bid_number
  `;

  // Debug: Log query results
  if (process.env.NODE_ENV === 'development') {
    console.log('[Auction Insights] Query Results:', {
      total_auctions: auctionInsights[0]?.total_auctions || 0,
      no_bid_auctions: auctionInsights[0]?.no_bid_auctions || 0,
      high_competition_auctions: auctionInsights[0]?.high_competition_auctions || 0,
      awarded_count: auctionInsights[0]?.awarded_count || 0,
    });
  }

  // Get peak bidding hours - filter by both auction received date and bid creation date
  // Build WHERE clause conditionally to avoid nested sql templates
  const bidDateFilterClause = endDate
    ? ` AND cb.created_at <= '${endDate.toISOString()}'`
    : '';
  
  // Build the complete WHERE clause as a string to avoid nested sql templates
  const whereClause = endDate
    ? `tb.received_at >= '${startDate.toISOString()}' AND tb.received_at <= '${endDate.toISOString()}' AND cb.created_at >= '${startDate.toISOString()}' AND cb.created_at <= '${endDate.toISOString()}'`
    : `tb.received_at >= '${startDate.toISOString()}' AND cb.created_at >= '${startDate.toISOString()}'`;
  
  const peakBiddingHours = await sql.unsafe(`
    SELECT 
      EXTRACT(HOUR FROM cb.created_at)::INTEGER as hour,
      COUNT(*)::INTEGER as bid_count
    FROM carrier_bids cb
    INNER JOIN telegram_bids tb ON cb.bid_number = tb.bid_number
    WHERE ${whereClause}
    GROUP BY EXTRACT(HOUR FROM cb.created_at)
    ORDER BY COUNT(*) DESC
    LIMIT 5
  `);

  // Get bid revision stats
  const bidRevisionStats = await sql`
    SELECT 
      COUNT(DISTINCT bid_number) as auctions_with_revisions,
      COUNT(*) as total_revisions,
      AVG(revision_count) as avg_revisions_per_carrier
    FROM (
      SELECT 
        bid_number,
        supabase_user_id,
        COUNT(*) as revision_count
      FROM carrier_bids
      WHERE ${bidDateFilter}
      GROUP BY bid_number, supabase_user_id
      HAVING COUNT(*) > 1
    ) revisions
  `;

  // Get route performance (top routes by competition)
  const topRoutesByCompetition = await sql`
    SELECT 
      tb.tag,
      COUNT(DISTINCT tb.bid_number) as auction_count,
      AVG(route_stats.bid_count) as avg_bids_per_auction,
      AVG(route_stats.unique_carriers) as avg_carriers_per_auction,
      SUM(route_stats.bid_count) as total_bids
    FROM telegram_bids tb
    INNER JOIN (
      SELECT 
        bid_number,
        COUNT(*) as bid_count,
        COUNT(DISTINCT supabase_user_id) as unique_carriers
      FROM carrier_bids
      GROUP BY bid_number
    ) route_stats ON tb.bid_number = route_stats.bid_number
    WHERE ${dateFilter}
      AND tb.tag IS NOT NULL
    GROUP BY tb.tag
    HAVING COUNT(DISTINCT tb.bid_number) >= 3
    ORDER BY AVG(route_stats.bid_count) DESC, SUM(route_stats.bid_count) DESC
    LIMIT 10
  `;

  const topCompetitiveAuctions = await sql`
    SELECT 
      tb.bid_number,
      tb.distance_miles,
      tb.tag,
      tb.received_at,
      COUNT(cb.id) as bid_count,
      COALESCE(MIN(cb.amount_cents), 0) as winning_bid_amount,
      COALESCE(MAX(cb.amount_cents), 0) as highest_bid_amount,
      COALESCE(AVG(cb.amount_cents), 0) as avg_bid_amount,
      COUNT(DISTINCT cb.supabase_user_id) as unique_carriers,
      MIN(cb.created_at) as first_bid_at,
      EXTRACT(EPOCH FROM (MIN(cb.created_at) - tb.received_at)) / 60 as minutes_to_first_bid
    FROM telegram_bids tb
    LEFT JOIN carrier_bids cb ON tb.bid_number = cb.bid_number
    WHERE ${dateFilter}
    GROUP BY tb.bid_number, tb.distance_miles, tb.tag, tb.received_at
    HAVING COUNT(cb.id) > 0
    ORDER BY COUNT(cb.id) DESC, (MAX(cb.amount_cents) - MIN(cb.amount_cents)) DESC
    LIMIT 50
  `;

  const insights = auctionInsights[0] || {};
  const revisionStats = bidRevisionStats[0] || {};
  
  // Calculate auction health score (0-100)
  const totalWithBids = (insights.total_auctions || 0) - (insights.no_bid_auctions || 0);
  const awardRate = totalWithBids > 0 
    ? ((insights.awarded_count || 0) / totalWithBids) * 100 
    : 0;
  const acceptanceRate = (insights.awarded_count || 0) > 0
    ? ((insights.accepted_count || 0) / (insights.awarded_count || 0)) * 100
    : 0;
  const competitionScore = Math.min((insights.avg_bids_per_auction || 0) / 5 * 100, 100);
  const engagementScore = Math.min((insights.avg_bids_per_carrier || 0) / 2 * 100, 100);
  
  const healthScore = (
    (awardRate * 0.3) +
    (acceptanceRate * 0.25) +
    (competitionScore * 0.25) +
    (engagementScore * 0.2)
  );

  const response = NextResponse.json({
    success: true,
    data: {
      auctionInsights: {
        ...insights,
        // Calculated rates
        award_rate_percentage: awardRate,
        acceptance_rate_percentage: acceptanceRate,
        auction_health_score: Math.round(healthScore),
        // Revision stats
        auctions_with_revisions: revisionStats.auctions_with_revisions || 0,
        total_revisions: revisionStats.total_revisions || 0,
        avg_revisions_per_carrier: revisionStats.avg_revisions_per_carrier || 0,
      },
      peakBiddingHours: peakBiddingHours || [],
      topRoutesByCompetition: topRoutesByCompetition || [],
      topCompetitiveAuctions,
      timeframe: {
        days: endDate 
          ? Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
          : Math.floor((new Date().getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)),
        startDate: startDate.toISOString(),
        endDate: endDate ? endDate.toISOString() : new Date().toISOString()
      }
    }
  });
  
  return addSecurityHeaders(response);
}
