import { requireAdmin } from "@/lib/auth";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // Ensure user is admin
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const timeframe = searchParams.get("timeframe") || "30"; // days
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const sortBy = searchParams.get("sortBy") || "total_bids"; // total_bids, win_rate, avg_bid, total_value

    // Calculate date range
    const daysAgo = parseInt(timeframe);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysAgo);

    // Get comprehensive carrier statistics
    const leaderboardData = await sql`
      WITH carrier_stats AS (
        SELECT 
          cp.clerk_user_id,
          cp.company_name,
          cp.legal_name,
          cp.mc_number,
          cp.dot_number,
          cp.contact_name,
          cp.phone,
          cp.email,
          cp.fleet_size,
          cp.equipment_types,
          cp.is_verified,
          cp.created_at as profile_created_at,
          
          -- Bid statistics
          COUNT(cb.id) as total_bids,
          COUNT(CASE WHEN cb.created_at >= ${startDate.toISOString()} THEN 1 END) as recent_bids,
          COUNT(CASE WHEN cb.amount_cents = (
            SELECT MIN(cb2.amount_cents) 
            FROM carrier_bids cb2 
            WHERE cb2.bid_number = cb.bid_number
          ) THEN 1 END) as winning_bids,
          
          -- Financial statistics
          COALESCE(AVG(cb.amount_cents), 0) as avg_bid_amount_cents,
          COALESCE(MIN(cb.amount_cents), 0) as min_bid_amount_cents,
          COALESCE(MAX(cb.amount_cents), 0) as max_bid_amount_cents,
          COALESCE(SUM(cb.amount_cents), 0) as total_bid_value_cents,
          
          -- Time-based statistics
          MIN(cb.created_at) as first_bid_at,
          MAX(cb.created_at) as last_bid_at,
          
          -- Auction participation
          COUNT(DISTINCT cb.bid_number) as unique_auctions_participated,
          COUNT(CASE WHEN tb.is_expired = true THEN 1 END) as expired_auctions_participated,
          COUNT(CASE WHEN tb.is_expired = false THEN 1 END) as active_auctions_participated
          
        FROM carrier_profiles cp
        LEFT JOIN carrier_bids cb ON cp.clerk_user_id = cb.clerk_user_id
        LEFT JOIN telegram_bids tb ON cb.bid_number = tb.bid_number
        GROUP BY cp.clerk_user_id, cp.company_name, cp.legal_name, cp.mc_number, 
                 cp.dot_number, cp.contact_name, cp.phone, cp.email, cp.fleet_size, 
                 cp.equipment_types, cp.is_verified, cp.created_at
      ),
      
      auction_wins AS (
        SELECT 
          cb.clerk_user_id,
          COUNT(*) as total_wins,
          COALESCE(AVG(cb.amount_cents), 0) as avg_winning_bid_cents,
          COALESCE(SUM(cb.amount_cents), 0) as total_winnings_cents
        FROM carrier_bids cb
        INNER JOIN telegram_bids tb ON cb.bid_number = tb.bid_number
        WHERE cb.amount_cents = (
          SELECT MIN(cb2.amount_cents) 
          FROM carrier_bids cb2 
          WHERE cb2.bid_number = cb.bid_number
        )
        AND tb.is_expired = true
        GROUP BY cb.clerk_user_id
      ),
      
      recent_activity AS (
        SELECT 
          cb.clerk_user_id,
          COUNT(CASE WHEN cb.created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as bids_last_7_days,
          COUNT(CASE WHEN cb.created_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as bids_last_24_hours,
          MAX(cb.created_at) as most_recent_bid_at
        FROM carrier_bids cb
        GROUP BY cb.clerk_user_id
      )
      
      SELECT 
        cs.*,
        COALESCE(aw.total_wins, 0) as total_wins,
        COALESCE(aw.avg_winning_bid_cents, 0) as avg_winning_bid_cents,
        COALESCE(aw.total_winnings_cents, 0) as total_winnings_cents,
        COALESCE(ra.bids_last_7_days, 0) as bids_last_7_days,
        COALESCE(ra.bids_last_24_hours, 0) as bids_last_24_hours,
        ra.most_recent_bid_at,
        
        -- Calculated metrics
        CASE 
          WHEN cs.total_bids > 0 THEN ROUND((COALESCE(aw.total_wins, 0)::DECIMAL / cs.total_bids * 100), 2)
          ELSE 0 
        END as win_rate_percentage,
        
        CASE 
          WHEN cs.total_bids > 0 THEN ROUND((cs.total_bids::DECIMAL / cs.unique_auctions_participated), 2)
          ELSE 0 
        END as avg_bids_per_auction,
        
        CASE 
          WHEN cs.first_bid_at IS NOT NULL THEN 
            EXTRACT(EPOCH FROM (cs.last_bid_at - cs.first_bid_at)) / 86400
          ELSE 0 
        END as days_active,
        
        CASE 
          WHEN cs.total_bids > 0 THEN 
            EXTRACT(EPOCH FROM (NOW() - cs.last_bid_at)) / 3600
          ELSE NULL 
        END as hours_since_last_bid
        
      FROM carrier_stats cs
      LEFT JOIN auction_wins aw ON cs.clerk_user_id = aw.clerk_user_id
      LEFT JOIN recent_activity ra ON cs.clerk_user_id = ra.clerk_user_id
      WHERE cs.total_bids > 0  -- Only include carriers who have placed bids
      ORDER BY 
        CASE WHEN ${sortBy} = 'total_bids' THEN cs.total_bids END DESC,
        CASE WHEN ${sortBy} = 'win_rate' THEN 
          CASE 
            WHEN cs.total_bids > 0 THEN (COALESCE(aw.total_wins, 0)::DECIMAL / cs.total_bids * 100)
            ELSE 0 
          END 
        END DESC,
        CASE WHEN ${sortBy} = 'avg_bid' THEN cs.avg_bid_amount_cents END ASC,
        CASE WHEN ${sortBy} = 'total_value' THEN cs.total_bid_value_cents END DESC,
        CASE WHEN ${sortBy} = 'recent_activity' THEN ra.bids_last_7_days END DESC,
        CASE WHEN ${sortBy} = 'wins' THEN COALESCE(aw.total_wins, 0) END DESC
      LIMIT ${limit}
    `;

    // Get summary statistics
    const summaryStats = await sql`
      SELECT 
        COUNT(DISTINCT cp.clerk_user_id) as total_carriers,
        COUNT(DISTINCT CASE WHEN cb.id IS NOT NULL THEN cp.clerk_user_id END) as active_carriers,
        COUNT(cb.id) as total_bids_placed,
        COUNT(CASE WHEN cb.created_at >= ${startDate.toISOString()} THEN cb.id END) as recent_bids_placed,
        COALESCE(AVG(cb.amount_cents), 0) as platform_avg_bid_cents,
        COALESCE(MIN(cb.amount_cents), 0) as platform_min_bid_cents,
        COALESCE(MAX(cb.amount_cents), 0) as platform_max_bid_cents,
        COUNT(DISTINCT cb.bid_number) as total_auctions_with_bids
      FROM carrier_profiles cp
      LEFT JOIN carrier_bids cb ON cp.clerk_user_id = cb.clerk_user_id
    `;

    // Get top performing carriers by different metrics
    const topPerformers = await sql`
      SELECT 
        'most_bids' as metric,
        cp.company_name,
        cp.legal_name,
        COUNT(cb.id) as value,
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
        cp.company_name,
        cp.legal_name,
        ROUND((COUNT(CASE WHEN cb.amount_cents = (
          SELECT MIN(cb2.amount_cents) 
          FROM carrier_bids cb2 
          WHERE cb2.bid_number = cb.bid_number
        ) THEN 1 END)::DECIMAL / COUNT(cb.id) * 100), 2) as value,
        '%' as unit
      FROM carrier_profiles cp
      INNER JOIN carrier_bids cb ON cp.clerk_user_id = cb.clerk_user_id
      WHERE cb.created_at >= ${startDate.toISOString()}
      GROUP BY cp.clerk_user_id, cp.company_name, cp.legal_name
      HAVING COUNT(cb.id) >= 5  -- Minimum 5 bids for win rate calculation
      ORDER BY value DESC
      LIMIT 1
      
      UNION ALL
      
      SELECT 
        'lowest_avg_bid' as metric,
        cp.company_name,
        cp.legal_name,
        ROUND(AVG(cb.amount_cents), 2) as value,
        'cents' as unit
      FROM carrier_profiles cp
      INNER JOIN carrier_bids cb ON cp.clerk_user_id = cb.clerk_user_id
      WHERE cb.created_at >= ${startDate.toISOString()}
      GROUP BY cp.clerk_user_id, cp.company_name, cp.legal_name
      HAVING COUNT(cb.id) >= 3  -- Minimum 3 bids for avg calculation
      ORDER BY value ASC
      LIMIT 1
    `;

    // Get equipment type statistics
    const equipmentStats = await sql`
      SELECT 
        COALESCE(cp.equipment_types::text, 'Unknown') as equipment_type,
        COUNT(DISTINCT cp.clerk_user_id) as carrier_count,
        COUNT(cb.id) as total_bids,
        COALESCE(AVG(cb.amount_cents), 0) as avg_bid_cents
      FROM carrier_profiles cp
      LEFT JOIN carrier_bids cb ON cp.clerk_user_id = cb.clerk_user_id
      WHERE cb.created_at >= ${startDate.toISOString()}
      GROUP BY cp.equipment_types
      ORDER BY total_bids DESC
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
        limit: limit
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
