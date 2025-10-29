import { requireAdmin } from "@/lib/auth";
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
    // Ensure user is admin
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const timeframe = searchParams.get("timeframe") || "30";
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const sortBy = searchParams.get("sortBy") || "total_bids";
    const equipmentType = searchParams.get("equipmentType") || null;
    const minBids = parseInt(searchParams.get("minBids") || "0");

    // Calculate date range
    const daysAgo = parseInt(timeframe);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysAgo);

    // Enhanced carrier statistics query using auction_awards for authoritative win data
    const leaderboardData = await sql`
      WITH 
      -- Base carrier profile data
      carrier_profiles_data AS (
        SELECT 
          cp.clerk_user_id,
          COALESCE(cp.company_name, cp.legal_name, 'Unknown') as company_name,
          cp.legal_name,
          cp.mc_number,
          cp.dot_number,
          cp.contact_name,
          cp.phone,
          cp.dispatch_email as email,
          COALESCE(cp.fleet_size, 1) as fleet_size,
          cp.equipment_types,
          COALESCE(cp.is_verified, false) as is_verified,
          cp.created_at as profile_created_at
        FROM carrier_profiles cp
        ${equipmentType ? sql`WHERE cp.equipment_types::text LIKE ${`%${equipmentType}%`}` : sql``}
      ),
      
      -- Bid statistics (all bids in timeframe)
      bid_stats AS (
        SELECT 
          cb.clerk_user_id,
          COUNT(cb.id) as total_bids,
          COUNT(CASE WHEN cb.created_at >= ${startDate.toISOString()} THEN 1 END) as bids_in_timeframe,
          COUNT(DISTINCT cb.bid_number) as unique_auctions_participated,
          COALESCE(AVG(cb.amount_cents), 0)::INTEGER as avg_bid_amount_cents,
          COALESCE(MIN(cb.amount_cents), 0) as min_bid_amount_cents,
          COALESCE(MAX(cb.amount_cents), 0) as max_bid_amount_cents,
          COALESCE(SUM(cb.amount_cents), 0) as total_bid_value_cents,
          MIN(cb.created_at) as first_bid_at,
          MAX(cb.created_at) as last_bid_at,
          -- Response time: average time between auction posted and bid placed
          COALESCE(AVG(
            EXTRACT(EPOCH FROM (cb.created_at - tb.received_at)) / 60
          ), 0)::INTEGER as avg_response_time_minutes
        FROM carrier_bids cb
        INNER JOIN telegram_bids tb ON cb.bid_number = tb.bid_number
        WHERE cb.created_at >= ${startDate.toISOString()}
        GROUP BY cb.clerk_user_id
      ),
      
      -- Win statistics using AUTHORITATIVE auction_awards table
      win_stats AS (
        SELECT 
          aa.winner_user_id as clerk_user_id,
          COUNT(*) as total_wins,
          COALESCE(AVG(aa.winner_amount_cents), 0)::INTEGER as avg_winning_bid_cents,
          COALESCE(SUM(aa.winner_amount_cents), 0) as total_revenue_cents,
          MIN(aa.awarded_at) as first_win_at,
          MAX(aa.awarded_at) as last_win_at
        FROM auction_awards aa
        WHERE aa.awarded_at >= ${startDate.toISOString()}
        GROUP BY aa.winner_user_id
      ),
      
      -- Bid competitiveness: how often carrier bid is within top 3 or within 5% of lowest
      competitiveness_stats AS (
        SELECT 
          cb.clerk_user_id,
          COUNT(*) as competitive_bids,
          COUNT(CASE 
            WHEN cb.amount_cents <= (
              SELECT MIN(cb2.amount_cents) * 1.05
              FROM carrier_bids cb2
              WHERE cb2.bid_number = cb.bid_number
            ) THEN 1
          END) as bids_within_5_percent
        FROM carrier_bids cb
        WHERE cb.created_at >= ${startDate.toISOString()}
        GROUP BY cb.clerk_user_id
      ),
      
      -- Recent activity metrics
      recent_activity AS (
        SELECT 
          cb.clerk_user_id,
          COUNT(CASE WHEN cb.created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as bids_last_7_days,
          COUNT(CASE WHEN cb.created_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as bids_last_24_hours,
          COUNT(CASE WHEN cb.created_at >= NOW() - INTERVAL '1 hour' THEN 1 END) as bids_last_hour,
          MAX(cb.created_at) as most_recent_bid_at
        FROM carrier_bids cb
        GROUP BY cb.clerk_user_id
      ),
      
      -- Combined statistics
      combined_stats AS (
        SELECT 
          cpd.*,
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
          
          -- Calculated metrics
          CASE 
            WHEN COALESCE(bs.total_bids, 0) > 0 
            THEN ROUND((COALESCE(ws.total_wins, 0)::DECIMAL / bs.total_bids * 100), 2)
            ELSE 0 
          END as win_rate_percentage,
          
          CASE 
            WHEN bs.unique_auctions_participated > 0 
            THEN ROUND((bs.total_bids::DECIMAL / bs.unique_auctions_participated), 2)
            ELSE 0 
          END as avg_bids_per_auction,
          
          CASE 
            WHEN bs.unique_auctions_participated > 0 
            THEN ROUND((COALESCE(cs.bids_within_5_percent, 0)::DECIMAL / bs.total_bids * 100), 2)
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
        LEFT JOIN bid_stats bs ON cpd.clerk_user_id = bs.clerk_user_id
        LEFT JOIN win_stats ws ON cpd.clerk_user_id = ws.clerk_user_id
        LEFT JOIN competitiveness_stats cs ON cpd.clerk_user_id = cs.clerk_user_id
        LEFT JOIN recent_activity ra ON cpd.clerk_user_id = ra.clerk_user_id
        WHERE COALESCE(bs.total_bids, 0) >= ${minBids}
      )
      
      SELECT * FROM combined_stats
      WHERE total_bids > 0
      ORDER BY 
        CASE WHEN ${sortBy} = 'total_bids' THEN total_bids END DESC,
        CASE WHEN ${sortBy} = 'win_rate' THEN win_rate_percentage END DESC,
        CASE WHEN ${sortBy} = 'avg_bid' THEN avg_bid_amount_cents END ASC,
        CASE WHEN ${sortBy} = 'total_value' THEN total_bid_value_cents END DESC,
        CASE WHEN ${sortBy} = 'recent_activity' THEN bids_last_7_days END DESC,
        CASE WHEN ${sortBy} = 'wins' THEN total_wins END DESC,
        CASE WHEN ${sortBy} = 'revenue' THEN total_revenue_cents END DESC,
        CASE WHEN ${sortBy} = 'competitiveness' THEN competitiveness_score END DESC
      LIMIT ${limit}
    `;

    // Enhanced summary statistics
    const summaryStats = await sql`
      SELECT 
        COUNT(DISTINCT cp.clerk_user_id) as total_carriers,
        COUNT(DISTINCT CASE WHEN cb.id IS NOT NULL THEN cp.clerk_user_id END) as active_carriers,
        COUNT(cb.id) as total_bids_placed,
        COUNT(CASE WHEN cb.created_at >= ${startDate.toISOString()} THEN cb.id END) as recent_bids_placed,
        COALESCE(AVG(cb.amount_cents), 0)::INTEGER as platform_avg_bid_cents,
        COALESCE(MIN(cb.amount_cents), 0) as platform_min_bid_cents,
        COALESCE(MAX(cb.amount_cents), 0) as platform_max_bid_cents,
        COUNT(DISTINCT cb.bid_number) as total_auctions_with_bids,
        COUNT(DISTINCT aa.winner_user_id) as unique_winners,
        COALESCE(SUM(aa.winner_amount_cents), 0) as total_platform_revenue_cents,
        COALESCE(AVG(
          EXTRACT(EPOCH FROM (cb.created_at - tb.received_at)) / 60
        ), 0)::INTEGER as platform_avg_response_time_minutes
      FROM carrier_profiles cp
      LEFT JOIN carrier_bids cb ON cp.clerk_user_id = cb.clerk_user_id
        AND cb.created_at >= ${startDate.toISOString()}
      LEFT JOIN telegram_bids tb ON cb.bid_number = tb.bid_number
      LEFT JOIN auction_awards aa ON aa.awarded_at >= ${startDate.toISOString()}
    `;

    // Enhanced top performers using auction_awards
    const topPerformers = await sql`
      SELECT 
        'most_bids' as metric,
        COALESCE(cp.company_name, cp.legal_name, 'Unknown') as company_name,
        cp.legal_name,
        COUNT(cb.id)::INTEGER as value,
        'bids' as unit
      FROM carrier_profiles cp
      INNER JOIN carrier_bids cb ON cp.clerk_user_id = cb.clerk_user_id
      WHERE cb.created_at >= ${startDate.toISOString()}
      GROUP BY cp.clerk_user_id, cp.company_name, cp.legal_name
      ORDER BY COUNT(cb.id) DESC
      LIMIT 1
      
      UNION ALL
      
      SELECT 
        'highest_win_rate' as metric,
        COALESCE(cp.company_name, cp.legal_name, 'Unknown') as company_name,
        cp.legal_name,
        ROUND((
          COUNT(CASE WHEN aa.winner_user_id = cp.clerk_user_id THEN 1 END)::DECIMAL / 
          NULLIF(COUNT(cb.id), 0) * 100
        ), 2) as value,
        '%' as unit
      FROM carrier_profiles cp
      INNER JOIN carrier_bids cb ON cp.clerk_user_id = cb.clerk_user_id
      LEFT JOIN auction_awards aa ON aa.bid_number = cb.bid_number
      WHERE cb.created_at >= ${startDate.toISOString()}
      GROUP BY cp.clerk_user_id, cp.company_name, cp.legal_name
      HAVING COUNT(cb.id) >= 5
      ORDER BY value DESC
      LIMIT 1
      
      UNION ALL
      
      SELECT 
        'most_revenue' as metric,
        COALESCE(cp.company_name, cp.legal_name, 'Unknown') as company_name,
        cp.legal_name,
        COALESCE(SUM(aa.winner_amount_cents), 0)::INTEGER as value,
        'cents' as unit
      FROM carrier_profiles cp
      INNER JOIN auction_awards aa ON cp.clerk_user_id = aa.winner_user_id
      WHERE aa.awarded_at >= ${startDate.toISOString()}
      GROUP BY cp.clerk_user_id, cp.company_name, cp.legal_name
      ORDER BY value DESC
      LIMIT 1
      
      UNION ALL
      
      SELECT 
        'lowest_avg_bid' as metric,
        COALESCE(cp.company_name, cp.legal_name, 'Unknown') as company_name,
        cp.legal_name,
        ROUND(AVG(cb.amount_cents), 0)::INTEGER as value,
        'cents' as unit
      FROM carrier_profiles cp
      INNER JOIN carrier_bids cb ON cp.clerk_user_id = cb.clerk_user_id
      WHERE cb.created_at >= ${startDate.toISOString()}
      GROUP BY cp.clerk_user_id, cp.company_name, cp.legal_name
      HAVING COUNT(cb.id) >= 3
      ORDER BY value ASC
      LIMIT 1
    `;

    // Equipment type statistics
    const equipmentStats = await sql`
      SELECT 
        COALESCE(cp.equipment_types::text, 'Unknown') as equipment_type,
        COUNT(DISTINCT cp.clerk_user_id) as carrier_count,
        COUNT(cb.id) as total_bids,
        COALESCE(AVG(cb.amount_cents), 0)::INTEGER as avg_bid_cents,
        COUNT(DISTINCT aa.winner_user_id) as total_winners
      FROM carrier_profiles cp
      LEFT JOIN carrier_bids cb ON cp.clerk_user_id = cb.clerk_user_id
        AND cb.created_at >= ${startDate.toISOString()}
      LEFT JOIN auction_awards aa ON aa.winner_user_id = cp.clerk_user_id
        AND aa.awarded_at >= ${startDate.toISOString()}
      GROUP BY cp.equipment_types
      ORDER BY total_bids DESC
      LIMIT 10
    `;

    return NextResponse.json({
      success: true,
      data: {
        leaderboard: leaderboardData,
        summary: summaryStats[0] || {},
        topPerformers: topPerformers,
        equipmentStats: equipmentStats,
        timeframe: {
          days: daysAgo,
          startDate: startDate.toISOString(),
          endDate: new Date().toISOString()
        },
        sortBy: sortBy,
        limit: limit,
        filters: {
          equipmentType: equipmentType,
          minBids: minBids
        }
      }
    });

  } catch (error) {
    console.error("Carrier leaderboard API error:", error);
    return NextResponse.json(
      { 
        success: false,
        error: "Failed to fetch carrier leaderboard",
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
