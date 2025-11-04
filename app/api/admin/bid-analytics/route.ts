import { requireApiAdmin } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // Ensure user is admin (Supabase-only)
    await requireApiAdmin(request);

    const { searchParams } = new URL(request.url);
    const timeframe = searchParams.get("timeframe") || "30"; // days
    const action = searchParams.get("action") || "overview";

    // Calculate date range
    const daysAgo = parseInt(timeframe);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysAgo);

    switch (action) {
      case "overview":
        return await getBidOverview(startDate);
      case "trends":
        return await getBidTrends(startDate);
      case "performance":
        return await getPerformanceMetrics(startDate);
      case "carrier_activity":
        return await getCarrierActivity(startDate);
      case "auction_insights":
        return await getAuctionInsights(startDate);
      default:
        return await getBidOverview(startDate);
    }

  } catch (error) {
    console.error("Bid analytics API error:", error);
    return NextResponse.json(
      { 
        success: false,
        error: "Failed to fetch bid analytics",
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

async function getBidOverview(startDate: Date) {
  // Get comprehensive bid overview statistics
  const overview = await sql`
    WITH bid_stats AS (
      SELECT 
        COUNT(tb.id) as total_auctions,
        COUNT(CASE WHEN tb.is_expired = false THEN 1 END) as active_auctions,
        COUNT(CASE WHEN tb.is_expired = true THEN 1 END) as expired_auctions,
        COUNT(CASE WHEN tb.received_at >= ${startDate.toISOString()} THEN 1 END) as recent_auctions,
        
        -- Today's specific counts
        COUNT(CASE WHEN tb.received_at::date = CURRENT_DATE THEN 1 END) as total_auctions_today,
        COUNT(CASE WHEN tb.received_at::date = CURRENT_DATE AND tb.is_expired = false THEN 1 END) as active_auctions_today,
        COUNT(CASE WHEN tb.received_at::date = CURRENT_DATE AND tb.is_expired = true THEN 1 END) as expired_auctions_today,
        
        COUNT(cb.id) as total_carrier_bids,
        COUNT(CASE WHEN cb.created_at >= ${startDate.toISOString()} THEN 1 END) as recent_carrier_bids,
        COUNT(CASE WHEN cb.created_at::date = CURRENT_DATE THEN 1 END) as total_carrier_bids_today,
        
        COUNT(DISTINCT cb.supabase_user_id) as unique_carriers_bid,
        COUNT(DISTINCT CASE WHEN cb.created_at >= ${startDate.toISOString()} THEN cb.supabase_user_id END) as recent_carriers_bid,
        
        COALESCE(AVG(cb.amount_cents), 0) as avg_bid_amount,
        COALESCE(MIN(cb.amount_cents), 0) as min_bid_amount,
        COALESCE(MAX(cb.amount_cents), 0) as max_bid_amount,
        
        COALESCE(AVG(tb.distance_miles), 0) as avg_distance,
        COALESCE(MIN(tb.distance_miles), 0) as min_distance,
        COALESCE(MAX(tb.distance_miles), 0) as max_distance
      FROM telegram_bids tb
      LEFT JOIN carrier_bids cb ON tb.bid_number = cb.bid_number
    ),
    
    winning_stats AS (
      SELECT 
        COUNT(*) as total_wins,
        COALESCE(AVG(cb.amount_cents), 0) as avg_winning_bid,
        COALESCE(SUM(cb.amount_cents), 0) as total_winnings_value
      FROM carrier_bids cb
      INNER JOIN telegram_bids tb ON cb.bid_number = tb.bid_number
      WHERE cb.amount_cents = (
        SELECT MIN(cb2.amount_cents) 
        FROM carrier_bids cb2 
        WHERE cb2.bid_number = cb.bid_number
      )
      AND tb.is_expired = true
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
        WHEN bs.total_carrier_bids > 0 THEN ROUND((bs.total_carrier_bids::DECIMAL / bs.total_auctions), 2)
        ELSE 0 
      END as avg_bids_per_auction_calc
      
    FROM bid_stats bs
    CROSS JOIN winning_stats ws
    CROSS JOIN competition_stats cs
  `;

  return NextResponse.json({
    success: true,
    data: {
      overview: overview[0] || {},
      timeframe: {
        days: Math.floor((new Date().getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)),
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString()
      }
    }
  });
}

async function getBidTrends(startDate: Date) {
  // Get daily bid trends
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
    GROUP BY DATE(tb.received_at)
    ORDER BY date DESC
    LIMIT 30
  `;

  // Get hourly trends for today
  const hourlyTrends = await sql`
    SELECT 
      EXTRACT(HOUR FROM tb.received_at) as hour,
      COUNT(tb.id) as auctions_created,
      COUNT(cb.id) as bids_placed
    FROM telegram_bids tb
    LEFT JOIN carrier_bids cb ON tb.bid_number = cb.bid_number
    WHERE DATE(tb.received_at) = CURRENT_DATE
    GROUP BY EXTRACT(HOUR FROM tb.received_at)
    ORDER BY hour
  `;

  return NextResponse.json({
    success: true,
    data: {
      dailyTrends,
      hourlyTrends,
      timeframe: {
        days: Math.floor((new Date().getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)),
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString()
      }
    }
  });
}

async function getPerformanceMetrics(startDate: Date) {
  // Get performance metrics by different dimensions
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
    WHERE tb.received_at >= ${startDate.toISOString()}
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
    WHERE tb.received_at >= ${startDate.toISOString()}
    GROUP BY tb.tag
    ORDER BY auction_count DESC
    LIMIT 20
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
    WHERE tb.received_at >= ${startDate.toISOString()}
    GROUP BY time_category
    ORDER BY auction_count DESC
  `;

  return NextResponse.json({
    success: true,
    data: {
      distancePerformance,
      tagPerformance,
      timePerformance,
      timeframe: {
        days: Math.floor((new Date().getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)),
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString()
      }
    }
  });
}

async function getCarrierActivity(startDate: Date) {
  // Get carrier activity patterns
  const activityPatterns = await sql`
    SELECT 
      cp.company_name,
      cp.legal_name,
      cp.mc_number,
      COUNT(cb.id) as total_bids,
      COUNT(CASE WHEN cb.created_at >= ${startDate.toISOString()} THEN 1 END) as recent_bids,
      MIN(cb.created_at) as first_bid_at,
      MAX(cb.created_at) as last_bid_at,
      COALESCE(AVG(cb.amount_cents), 0) as avg_bid_amount,
      COUNT(CASE WHEN cb.amount_cents = (
        SELECT MIN(cb2.amount_cents) 
        FROM carrier_bids cb2 
        WHERE cb2.bid_number = cb.bid_number
      ) THEN 1 END) as winning_bids,
      
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
    WHERE cb.created_at >= ${startDate.toISOString()}
    GROUP BY cp.supabase_user_id, cp.company_name, cp.legal_name, cp.mc_number
    ORDER BY recent_bids DESC
    LIMIT 50
  `;

  return NextResponse.json({
    success: true,
    data: {
      activityPatterns,
      timeframe: {
        days: Math.floor((new Date().getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)),
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString()
      }
    }
  });
}

async function getAuctionInsights(startDate: Date) {
  // Get auction-specific insights
  const auctionInsights = await sql`
    WITH auction_competition AS (
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
        tb.is_expired
      FROM telegram_bids tb
      LEFT JOIN carrier_bids cb ON tb.bid_number = cb.bid_number
      WHERE tb.received_at >= ${startDate.toISOString()}
      GROUP BY tb.bid_number, tb.distance_miles, tb.tag, tb.received_at, tb.is_expired
    )
    
    SELECT 
      COUNT(*) as total_auctions,
      COUNT(CASE WHEN bid_count = 0 THEN 1 END) as no_bid_auctions,
      COUNT(CASE WHEN bid_count = 1 THEN 1 END) as single_bid_auctions,
      COUNT(CASE WHEN bid_count BETWEEN 2 AND 5 THEN 1 END) as moderate_competition_auctions,
      COUNT(CASE WHEN bid_count > 5 THEN 1 END) as high_competition_auctions,
      
      COALESCE(AVG(bid_count), 0) as avg_bids_per_auction,
      COALESCE(MAX(bid_count), 0) as max_bids_per_auction,
      
      COALESCE(AVG(winning_bid_amount), 0) as avg_winning_bid,
      COALESCE(AVG(highest_bid_amount), 0) as avg_highest_bid,
      COALESCE(AVG(avg_bid_amount), 0) as avg_bid_amount_overall,
      
      COALESCE(AVG(distance_miles), 0) as avg_distance,
      
      -- Competition intensity
      COALESCE(AVG(highest_bid_amount - winning_bid_amount), 0) as avg_bid_spread,
      
      -- Time to first bid
      COUNT(CASE WHEN bid_count > 0 THEN 1 END) as auctions_with_bids
      
    FROM auction_competition
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
      COUNT(DISTINCT cb.supabase_user_id) as unique_carriers
    FROM telegram_bids tb
    LEFT JOIN carrier_bids cb ON tb.bid_number = cb.bid_number
    WHERE tb.received_at >= ${startDate.toISOString()}
    GROUP BY tb.bid_number, tb.distance_miles, tb.tag, tb.received_at
    HAVING COUNT(cb.id) > 0
    ORDER BY COUNT(cb.id) DESC, (MAX(cb.amount_cents) - MIN(cb.amount_cents)) DESC
    LIMIT 20
  `;

  return NextResponse.json({
    success: true,
    data: {
      auctionInsights: auctionInsights[0] || {},
      topCompetitiveAuctions,
      timeframe: {
        days: Math.floor((new Date().getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)),
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString()
      }
    }
  });
}
