import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

/**
 * Enhanced Carrier Leaderboard API
 * 
 * Provides comprehensive carrier performance metrics including:
 * - Win rates based on authoritative auction_awards table
 * - Response time analytics
 * - Bid competitiveness metrics
 * - Revenue and engagement statistics
 * 
 * @route GET /api/admin/carrier-leaderboard
 * @query timeframe: Number of days (default: 30)
 * @query sortBy: Sort field (total_bids, win_rate, avg_bid, total_value, recent_activity, wins, revenue)
 * @query limit: Max results (default: 50, max: 100)
 * @query equipmentType: Filter by equipment tag
 * @query minBids: Minimum bids required for inclusion
 */
export async function GET(request: NextRequest) {
  try {
    // Ensure user is admin (Supabase-only)
    const auth = await requireApiAdmin(request);
    const userId = auth.userId;

    // Check rate limit for admin read operation (analytics can be resource-intensive)
    const rateLimit = await checkApiRateLimit(request, {
      userId,
      routeType: 'readOnly'
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
    const timeframe = searchParams.get("timeframe") || "30";
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");
    const limitParam = searchParams.get("limit") || "50";
    const limit = limitParam === "all" ? 1000 : Math.min(parseInt(limitParam), 1000);
    const sortBy = searchParams.get("sortBy") || "total_bids";
    const equipmentType = searchParams.get("equipmentType") || null;
    const minBids = parseInt(searchParams.get("minBids") || "0");
    const carrierId = searchParams.get("carrierId") || null; // Support filtering by specific carrier

    // Input validation
    const validation = validateInput(
      { timeframe, startDateParam, endDateParam, limitParam, sortBy, minBids, carrierId },
      {
        timeframe: { type: 'string', maxLength: 50, required: false },
        startDateParam: { type: 'string', pattern: /^\d{4}-\d{2}-\d{2}$/, required: false },
        endDateParam: { type: 'string', pattern: /^\d{4}-\d{2}-\d{2}$/, required: false },
        limitParam: { type: 'string', pattern: /^(all|\d+)$/, required: false },
        sortBy: { type: 'string', enum: ['total_bids', 'win_rate', 'avg_bid', 'total_value', 'recent_activity', 'wins', 'revenue'], required: false },
        minBids: { type: 'string', pattern: /^\d+$/, required: false },
        carrierId: { type: 'string', maxLength: 200, required: false }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_carrier_leaderboard_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // Calculate date range - support custom date range, "today", "all", or numeric days
    let startDate: Date | null = null;
    let endDate: Date | null = null;
    let daysAgo: number = 0;
    
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
    } else if (timeframe !== "all") {
      // Numeric days
      daysAgo = parseInt(timeframe);
      startDate = new Date();
      startDate.setDate(startDate.getDate() - daysAgo);
      startDate.setHours(0, 0, 0, 0); // Normalize to start of day
      endDate = new Date();
      endDate.setHours(23, 59, 59, 999);
    }
    console.log('[Carrier Leaderboard] Query params:', { timeframe, limit, startDate: startDate?.toISOString() || 'all time' });
    console.log('[Carrier Leaderboard] Starting query execution...');

    // Lightweight in-memory cache (30s TTL) to collapse bursts
    // Skip cache if filtering by specific carrierId (always get fresh data for details view)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g: any = globalThis as any;
    g.__leader_cache = g.__leader_cache || new Map<string, { t: number; v: any }>();
    const cacheKey = `leader:${timeframe}:${sortBy}:${limit}:${equipmentType || 'all'}:${minBids}:${carrierId || 'all'}`;
    const now = Date.now();
    const hit = g.__leader_cache.get(cacheKey);
    // Don't use cache for carrierId-specific queries to ensure fresh data
    if (!carrierId && hit && now - hit.t < 30_000) {
      const cachedResponse = NextResponse.json(hit.v);
      return addSecurityHeaders(cachedResponse);
    }

    // Enhanced carrier statistics query using auction_awards for authoritative win data
    let leaderboardData;
    try {
      leaderboardData = await sql`
      WITH 
      -- Base carrier profile data (uses current profile data - reflects latest updates)
      carrier_profiles_data AS (
        SELECT 
          cp.supabase_user_id,
          COALESCE(cp.company_name, cp.legal_name, 'Unknown') as company_name,
          cp.legal_name,
          cp.mc_number,
          cp.dot_number,
          cp.contact_name,
          cp.phone,
          NULL as email, -- dispatch_email doesn't exist in carrier_profiles
          NULL::JSONB as equipment_types, -- equipment_types doesn't exist
          false as is_verified, -- is_verified doesn't exist, default to false
          cp.created_at as profile_created_at
        FROM carrier_profiles cp
        ${carrierId ? sql`WHERE cp.supabase_user_id = ${carrierId}` : sql``}
        -- Note: equipment_types column doesn't exist in carrier_profiles, so filtering is disabled for now
      ),
      
      -- Fleet size: count of driver profiles per carrier
      fleet_size_stats AS (
        SELECT 
          dp.carrier_user_id as supabase_user_id,
          COUNT(*)::INTEGER as fleet_size
        FROM driver_profiles dp
        WHERE dp.is_active = true
        GROUP BY dp.carrier_user_id
      ),
      
      -- Bid statistics: total_bids is all-time, bids_in_timeframe is filtered
      bid_stats AS (
        SELECT 
          cb.supabase_user_id,
          COUNT(cb.id) as total_bids,
          COUNT(CASE 
            ${startDate && endDate ? sql`WHEN cb.created_at >= ${startDate} AND cb.created_at <= ${endDate} THEN 1` : startDate ? sql`WHEN cb.created_at >= ${startDate} THEN 1` : sql`WHEN 1=1 THEN 1`}
          END) as bids_in_timeframe,
          COUNT(DISTINCT cb.bid_number) as unique_auctions_participated,
          COALESCE(AVG(cb.amount_cents), 0)::INTEGER as avg_bid_amount_cents,
          COALESCE(MIN(cb.amount_cents), 0) as min_bid_amount_cents,
          COALESCE(MAX(cb.amount_cents), 0) as max_bid_amount_cents,
          COALESCE(SUM(cb.amount_cents), 0) as total_bid_value_cents,
          MIN(cb.created_at) as first_bid_at,
          MAX(cb.created_at) as last_bid_at,
          -- Response time: average time between auction posted and bid placed (timeframe-filtered)
          COALESCE(AVG(CASE 
            ${startDate && endDate ? sql`WHEN cb.created_at >= ${startDate} AND cb.created_at <= ${endDate} THEN EXTRACT(EPOCH FROM (cb.created_at - tb.received_at)) / 60` : startDate ? sql`WHEN cb.created_at >= ${startDate} THEN EXTRACT(EPOCH FROM (cb.created_at - tb.received_at)) / 60` : sql`WHEN 1=1 THEN EXTRACT(EPOCH FROM (cb.created_at - tb.received_at)) / 60`}
          END), 0)::INTEGER as avg_response_time_minutes
        FROM carrier_bids cb
        LEFT JOIN telegram_bids tb ON cb.bid_number = tb.bid_number
        GROUP BY cb.supabase_user_id
      ),
      
      -- Win statistics using AUTHORITATIVE auction_awards table: total_wins is all-time, wins_in_timeframe is filtered
      win_stats AS (
        SELECT 
          aa.supabase_winner_user_id as supabase_user_id,
          COUNT(*) as total_wins,
          COUNT(CASE 
            ${startDate && endDate ? sql`WHEN aa.awarded_at >= ${startDate} AND aa.awarded_at <= ${endDate} THEN 1` : startDate ? sql`WHEN aa.awarded_at >= ${startDate} THEN 1` : sql`WHEN 1=1 THEN 1`}
          END) as wins_in_timeframe,
          COALESCE(AVG(aa.winner_amount_cents), 0)::INTEGER as avg_winning_bid_cents,
          COALESCE(SUM(aa.winner_amount_cents), 0) as total_revenue_cents,
          MIN(aa.awarded_at) as first_win_at,
          MAX(aa.awarded_at) as last_win_at
        FROM auction_awards aa
        GROUP BY aa.supabase_winner_user_id
      ),
      
      -- Bid competitiveness: how often carrier bid is within top 3 or within 5% of lowest (filtered by timeframe when specified)
      competitiveness_stats AS (
        SELECT 
          cb.supabase_user_id,
          COUNT(*) as competitive_bids,
          COUNT(CASE 
            WHEN cb.amount_cents <= (
              SELECT MIN(cb2.amount_cents) * 1.05
              FROM carrier_bids cb2
              WHERE cb2.bid_number = cb.bid_number
            ) THEN 1
          END) as bids_within_5_percent
        FROM carrier_bids cb
        ${startDate && endDate ? sql`WHERE cb.created_at >= ${startDate} AND cb.created_at <= ${endDate}` : startDate ? sql`WHERE cb.created_at >= ${startDate}` : sql``}
        GROUP BY cb.supabase_user_id
      ),
      
      -- Recent activity metrics
      recent_activity AS (
        SELECT 
          cb.supabase_user_id,
          COUNT(CASE WHEN cb.created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as bids_last_7_days,
          COUNT(CASE WHEN cb.created_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as bids_last_24_hours,
          COUNT(CASE WHEN cb.created_at >= NOW() - INTERVAL '1 hour' THEN 1 END) as bids_last_hour,
          MAX(cb.created_at) as most_recent_bid_at
        FROM carrier_bids cb
        GROUP BY cb.supabase_user_id
      ),
      
      -- Combined statistics
      combined_stats AS (
        SELECT 
          cpd.*,
          COALESCE(fs.fleet_size, 0) as fleet_size, -- Count of driver profiles
          COALESCE(bs.total_bids, 0) as total_bids,
          COALESCE(bs.bids_in_timeframe, 0) as bids_in_timeframe,
          COALESCE(bs.unique_auctions_participated, 0) as unique_auctions_participated,
          COALESCE(bs.avg_bid_amount_cents, 0) as avg_bid_amount_cents,
          COALESCE(bs.min_bid_amount_cents, 0) as min_bid_amount_cents,
          COALESCE(bs.max_bid_amount_cents, 0) as max_bid_amount_cents,
          COALESCE(bs.total_bid_value_cents, 0) as total_bid_value_cents,
          bs.first_bid_at,
          bs.last_bid_at,
          COALESCE(bs.avg_response_time_minutes, 0) as avg_response_time_minutes,
          
          -- Win statistics (from authoritative auction_awards)
          COALESCE(ws.total_wins, 0) as total_wins,
          COALESCE(ws.avg_winning_bid_cents, 0) as avg_winning_bid_cents,
          COALESCE(ws.total_revenue_cents, 0) as total_revenue_cents,
          ws.first_win_at,
          ws.last_win_at,
          
          -- Competitiveness
          COALESCE(cs.competitive_bids, 0) as competitive_bids,
          COALESCE(cs.bids_within_5_percent, 0) as bids_within_5_percent,
          
          -- Recent activity
          COALESCE(ra.bids_last_7_days, 0) as bids_last_7_days,
          COALESCE(ra.bids_last_24_hours, 0) as bids_last_24_hours,
          COALESCE(ra.bids_last_hour, 0) as bids_last_hour,
          ra.most_recent_bid_at,
          
          -- Calculated metrics (use bids_in_timeframe for timeframe-specific calculations)
          CASE 
            WHEN COALESCE(bs.bids_in_timeframe, 0) > 0 
            THEN ROUND((COALESCE(ws.wins_in_timeframe, 0)::DECIMAL / bs.bids_in_timeframe * 100), 2)
            ELSE 0 
          END as win_rate_percentage,
          
          CASE 
            WHEN bs.unique_auctions_participated > 0 
            THEN ROUND((bs.bids_in_timeframe::DECIMAL / bs.unique_auctions_participated), 2)
            ELSE 0 
          END as avg_bids_per_auction,
          
          CASE 
            WHEN COALESCE(bs.bids_in_timeframe, 0) > 0 
            THEN ROUND((COALESCE(cs.bids_within_5_percent, 0)::DECIMAL / bs.bids_in_timeframe * 100), 2)
            ELSE 0 
          END as competitiveness_score,
          
          CASE 
            WHEN bs.first_bid_at IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (bs.last_bid_at - bs.first_bid_at)) / 86400
            ELSE 0 
          END as days_active,
          
          CASE 
            WHEN bs.total_bids > 0 
            THEN EXTRACT(EPOCH FROM (NOW() - bs.last_bid_at)) / 3600
            ELSE NULL 
          END as hours_since_last_bid
          
        FROM carrier_profiles_data cpd
        LEFT JOIN fleet_size_stats fs ON cpd.supabase_user_id = fs.supabase_user_id
        LEFT JOIN bid_stats bs ON cpd.supabase_user_id = bs.supabase_user_id
        LEFT JOIN win_stats ws ON cpd.supabase_user_id = ws.supabase_user_id
        LEFT JOIN competitiveness_stats cs ON cpd.supabase_user_id = cs.supabase_user_id
        LEFT JOIN recent_activity ra ON cpd.supabase_user_id = ra.supabase_user_id
        WHERE ${carrierId ? sql`1=1` : sql`COALESCE(bs.bids_in_timeframe, 0) >= ${minBids}`} -- Skip minBids filter when filtering by carrierId, use bids_in_timeframe
      )
      
      SELECT * FROM combined_stats
      WHERE ${carrierId ? sql`1=1` : sql`bids_in_timeframe > 0`} -- If filtering by carrierId, show even if no bids (for details view), use bids_in_timeframe
      ORDER BY 
        CASE WHEN ${sortBy} = 'total_bids' THEN bids_in_timeframe END DESC,
        CASE WHEN ${sortBy} = 'win_rate' THEN win_rate_percentage END DESC,
        CASE WHEN ${sortBy} = 'avg_bid' THEN avg_bid_amount_cents END ASC,
        CASE WHEN ${sortBy} = 'recent_activity' THEN bids_last_7_days END DESC,
        CASE WHEN ${sortBy} = 'wins' THEN wins_in_timeframe END DESC,
        CASE WHEN ${sortBy} = 'revenue' THEN total_revenue_cents END DESC,
        CASE WHEN ${sortBy} = 'competitiveness' THEN competitiveness_score END DESC
      LIMIT ${limit}
    `;
      console.log('[Carrier Leaderboard] Main query completed, rows:', leaderboardData?.length || 0);
    } catch (queryError) {
      console.error('[Carrier Leaderboard] Main query failed:', queryError);
      throw queryError;
    }

    // Enhanced summary statistics
    let summaryStats;
    try {
      console.log('[Carrier Leaderboard] Executing summary stats query...');
      // Fix: Count ALL bids for total_bids_placed, timeframe-filtered for recent_bids_placed
      summaryStats = await sql`
      WITH all_bids AS (
        SELECT COUNT(*)::INTEGER as total_count
        FROM carrier_bids
      ),
      timeframe_bids AS (
        SELECT 
          COUNT(*)::INTEGER as recent_count,
          COUNT(DISTINCT cb.supabase_user_id)::INTEGER as active_carrier_count,
          COUNT(DISTINCT cb.bid_number)::INTEGER as recent_auctions_count,
          COALESCE(AVG(cb.amount_cents), 0)::INTEGER as avg_bid_cents,
          COALESCE(MIN(cb.amount_cents), 0)::INTEGER as min_bid_cents,
          COALESCE(MAX(cb.amount_cents), 0)::INTEGER as max_bid_cents,
          COALESCE(AVG(
            EXTRACT(EPOCH FROM (cb.created_at - tb.received_at)) / 60
          ), 0)::INTEGER as avg_response_time
        FROM carrier_bids cb
        LEFT JOIN telegram_bids tb ON cb.bid_number = tb.bid_number
        ${startDate && endDate ? sql`WHERE cb.created_at >= ${startDate} AND cb.created_at <= ${endDate}` : startDate ? sql`WHERE cb.created_at >= ${startDate}` : sql``}
      ),
      awards_stats AS (
        SELECT
          COUNT(DISTINCT aa.supabase_winner_user_id)::INTEGER as unique_winners,
          COALESCE(SUM(winner_amount_cents), 0)::BIGINT as total_revenue
        FROM auction_awards aa
        ${startDate && endDate ? sql`WHERE aa.awarded_at >= ${startDate} AND aa.awarded_at <= ${endDate}` : startDate ? sql`WHERE aa.awarded_at >= ${startDate}` : sql``}
      )
      SELECT 
        (SELECT COUNT(DISTINCT supabase_user_id)::INTEGER FROM carrier_profiles) as total_carriers,
        tf.active_carrier_count as active_carriers,
        ab.total_count as total_bids_placed,
        tf.recent_count as recent_bids_placed,
        tf.avg_bid_cents as platform_avg_bid_cents,
        tf.min_bid_cents as platform_min_bid_cents,
        tf.max_bid_cents as platform_max_bid_cents,
        tf.recent_auctions_count as total_auctions_with_bids,
        aw.unique_winners,
        aw.total_revenue as total_platform_revenue_cents,
        tf.avg_response_time as platform_avg_response_time_minutes
      FROM all_bids ab
      CROSS JOIN timeframe_bids tf
      CROSS JOIN awards_stats aw
    `;
      console.log('[Carrier Leaderboard] Summary stats query completed');
    } catch (summaryError) {
      console.error('[Carrier Leaderboard] Summary stats query failed:', summaryError);
      throw summaryError;
    }

    // Enhanced top performers using auction_awards
    let topPerformers;
    try {
      console.log('[Carrier Leaderboard] Executing top performers query...');
      // PostgreSQL requires parentheses around SELECT statements with ORDER BY in UNION queries
      topPerformers = await sql`
      (SELECT 
        'most_bids' as metric,
        COALESCE(cp.company_name, cp.legal_name, 'Unknown') as company_name,
        cp.legal_name,
        COUNT(cb.id)::INTEGER as value,
        'bids' as unit
      FROM carrier_profiles cp
      INNER JOIN carrier_bids cb ON cp.supabase_user_id = cb.supabase_user_id
      ${startDate && endDate ? sql`WHERE cb.created_at >= ${startDate} AND cb.created_at <= ${endDate}` : startDate ? sql`WHERE cb.created_at >= ${startDate}` : sql``}
      GROUP BY cp.supabase_user_id, cp.company_name, cp.legal_name
      ORDER BY COUNT(cb.id) DESC
      LIMIT 1)
      
      UNION ALL
      
      (SELECT 
        'highest_win_rate' as metric,
        COALESCE(cp.company_name, cp.legal_name, 'Unknown') as company_name,
        cp.legal_name,
        ROUND((
          COUNT(CASE WHEN aa.supabase_winner_user_id = cp.supabase_user_id THEN 1 END)::DECIMAL / 
          NULLIF(COUNT(cb.id), 0) * 100
        ), 2) as value,
        '%' as unit
      FROM carrier_profiles cp
      INNER JOIN carrier_bids cb ON cp.supabase_user_id = cb.supabase_user_id
      LEFT JOIN auction_awards aa ON aa.bid_number = cb.bid_number
      ${startDate && endDate ? sql`WHERE cb.created_at >= ${startDate} AND cb.created_at <= ${endDate}` : startDate ? sql`WHERE cb.created_at >= ${startDate}` : sql``}
      GROUP BY cp.supabase_user_id, cp.company_name, cp.legal_name
      HAVING COUNT(cb.id) >= 5
      ORDER BY value DESC
      LIMIT 1)
      
      UNION ALL
      
      (SELECT 
        'most_revenue' as metric,
        COALESCE(cp.company_name, cp.legal_name, 'Unknown') as company_name,
        cp.legal_name,
        COALESCE(SUM(aa.winner_amount_cents), 0)::INTEGER as value,
        'cents' as unit
      FROM carrier_profiles cp
      INNER JOIN auction_awards aa ON cp.supabase_user_id = aa.supabase_winner_user_id
      ${startDate && endDate ? sql`WHERE aa.awarded_at >= ${startDate} AND aa.awarded_at <= ${endDate}` : startDate ? sql`WHERE aa.awarded_at >= ${startDate}` : sql``}
      GROUP BY cp.supabase_user_id, cp.company_name, cp.legal_name
      ORDER BY value DESC
      LIMIT 1)
      
      UNION ALL
      
      (SELECT 
        'lowest_avg_bid' as metric,
        COALESCE(cp.company_name, cp.legal_name, 'Unknown') as company_name,
        cp.legal_name,
        ROUND(AVG(cb.amount_cents), 0)::INTEGER as value,
        'cents' as unit
      FROM carrier_profiles cp
      INNER JOIN carrier_bids cb ON cp.supabase_user_id = cb.supabase_user_id
      ${startDate && endDate ? sql`WHERE cb.created_at >= ${startDate} AND cb.created_at <= ${endDate}` : startDate ? sql`WHERE cb.created_at >= ${startDate}` : sql``}
      GROUP BY cp.supabase_user_id, cp.company_name, cp.legal_name
      HAVING COUNT(cb.id) >= 3
      ORDER BY value ASC
      LIMIT 1)
    `;
      console.log('[Carrier Leaderboard] Top performers query completed, rows:', topPerformers?.length || 0);
    } catch (topPerformersError) {
      console.error('[Carrier Leaderboard] Top performers query failed:', topPerformersError);
      throw topPerformersError;
    }

    // Equipment type statistics
    let equipmentStats;
    try {
      console.log('[Carrier Leaderboard] Executing equipment stats query...');
      equipmentStats = await sql`
      SELECT 
        'Unknown' as equipment_type,
        COUNT(DISTINCT cp.supabase_user_id) as carrier_count,
        COUNT(cb.id) as total_bids,
        COALESCE(AVG(cb.amount_cents), 0)::INTEGER as avg_bid_cents,
        COUNT(DISTINCT aa.supabase_winner_user_id) as total_winners
      FROM carrier_profiles cp
      LEFT JOIN carrier_bids cb ON cp.supabase_user_id = cb.supabase_user_id
        ${startDate ? sql`AND cb.created_at >= ${startDate}` : sql``}
      LEFT JOIN auction_awards aa ON aa.supabase_winner_user_id = cp.supabase_user_id
        ${startDate ? sql`AND aa.awarded_at >= ${startDate}` : sql``}
      GROUP BY equipment_type
      ORDER BY total_bids DESC
      LIMIT 10
    `;
      console.log('[Carrier Leaderboard] Equipment stats query completed, rows:', equipmentStats?.length || 0);
    } catch (equipmentError) {
      console.error('[Carrier Leaderboard] Equipment stats query failed:', equipmentError);
      throw equipmentError;
    }

    // Log for debugging
    console.log('[Carrier Leaderboard] Query executed successfully', {
      leaderboardCount: Array.isArray(leaderboardData) ? leaderboardData.length : 0,
      leaderboardSample: Array.isArray(leaderboardData) ? leaderboardData.slice(0, 2) : leaderboardData,
      summary: summaryStats[0] || {},
      topPerformersCount: Array.isArray(topPerformers) ? topPerformers.length : 0,
      timeframe: { days: daysAgo, startDate: startDate?.toISOString() || 'all time' },
      queryParams: { timeframe, sortBy, limit, minBids }
    });

    const payload = {
      success: true,
      data: {
        leaderboard: leaderboardData || [],
        summary: summaryStats[0] || {},
        topPerformers: topPerformers || [],
        equipmentStats: equipmentStats || [],
        timeframe: {
          days: daysAgo,
          startDate: startDate?.toISOString() || 'all time',
          endDate: new Date().toISOString()
        },
        sortBy: sortBy,
        limit: limit,
        filters: {
          equipmentType: equipmentType,
          minBids: minBids
        }
      }
    };

    g.__leader_cache.set(cacheKey, { t: now, v: payload });
    
    logSecurityEvent('carrier_leaderboard_accessed', userId, { 
      timeframe, 
      sortBy, 
      limit,
      carrierId: carrierId || null
    });
    
    const response = NextResponse.json(payload);
    return addSecurityHeaders(response);

  } catch (error: any) {
    console.error("Carrier leaderboard API error:", error);
    console.error("Error type:", typeof error);
    console.error("Error constructor:", error?.constructor?.name);
    
    // Handle authentication/authorization errors
    if (error instanceof Error) {
      console.error("Error name:", error.name);
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
      
      // Check for SQL errors
      if ((error as any).code) {
        console.error("SQL Error Code:", (error as any).code);
        console.error("SQL Error Detail:", (error as any).detail);
        console.error("SQL Error Hint:", (error as any).hint);
      }
      
      if (error.message === "Unauthorized" || error.message.includes("Unauthorized")) {
        return unauthorizedResponse();
      }
      
      if (error.message === "Admin access required" || error.message.includes("Admin access")) {
        const response = NextResponse.json(
          { 
            success: false,
            error: "Admin access required"
          },
          { status: 403 }
        );
        return addSecurityHeaders(response);
      }
    }
    
    logSecurityEvent('carrier_leaderboard_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        success: false,
        error: "Failed to fetch carrier leaderboard",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}
