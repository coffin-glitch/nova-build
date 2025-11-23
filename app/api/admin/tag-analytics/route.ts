import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiAdmin(request);
    const userId = auth.userId;

    const { searchParams } = new URL(request.url);
    const tag = searchParams.get("tag");
    const timeframe = searchParams.get("timeframe") || "30";

    // Input validation
    const validation = validateInput(
      { tag, timeframe },
      {
        tag: { required: true, type: 'string', pattern: /^[A-Z0-9\-_]+$/, maxLength: 50 },
        timeframe: { type: 'string', pattern: /^(all|\d+)$/, maxLength: 20, required: false }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_tag_analytics_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { success: false, error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    if (!tag) {
      const response = NextResponse.json(
        { success: false, error: "Tag parameter is required" },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // Calculate date range
    let startDate: Date;
    if (timeframe === "all") {
      startDate = new Date('2000-01-01T00:00:00.000Z');
    } else {
      const daysAgo = parseInt(timeframe);
      startDate = new Date();
      startDate.setDate(startDate.getDate() - daysAgo);
    }

    // Summary statistics
    const summary = await sql`
      WITH auction_stats AS (
        SELECT 
          tb.id,
          tb.distance_miles,
          COUNT(cb.id) as bid_count,
          COALESCE(MIN(cb.amount_cents), 0) as min_bid,
          COALESCE(MAX(cb.amount_cents), 0) as max_bid,
          COALESCE(AVG(cb.amount_cents), 0) as avg_bid,
          COUNT(DISTINCT cb.supabase_user_id) as unique_carriers_per_auction
        FROM telegram_bids tb
        LEFT JOIN carrier_bids cb ON tb.bid_number = cb.bid_number
        WHERE tb.tag = ${tag}
          AND tb.received_at >= ${startDate.toISOString()}
        GROUP BY tb.id, tb.distance_miles
      )
      SELECT 
        COUNT(*) as total_auctions,
        COUNT(CASE WHEN bid_count = 0 THEN 1 END) as no_bid_auctions,
        SUM(bid_count) as total_bids,
        COUNT(DISTINCT CASE WHEN bid_count > 0 THEN auction_stats.id END) as auctions_with_bids,
        COALESCE(AVG(bid_count), 0) as avg_bids_per_auction,
        COALESCE(AVG(avg_bid), 0) as avg_bid_amount,
        COALESCE(MIN(min_bid), 0) as min_bid_amount,
        COALESCE(MAX(max_bid), 0) as max_bid_amount,
        COALESCE(AVG(distance_miles), 0) as avg_distance,
        (SELECT COUNT(DISTINCT cb.supabase_user_id) 
         FROM telegram_bids tb2
         LEFT JOIN carrier_bids cb ON tb2.bid_number = cb.bid_number
         WHERE tb2.tag = ${tag}
           AND tb2.received_at >= ${startDate.toISOString()}) as unique_carriers,
        (SELECT COUNT(DISTINCT cb.supabase_user_id)::DECIMAL / NULLIF(COUNT(*), 0) * 100
         FROM telegram_bids tb3
         LEFT JOIN carrier_bids cb ON tb3.bid_number = cb.bid_number
         WHERE tb3.tag = ${tag}
           AND tb3.received_at >= ${startDate.toISOString()}) as carrier_participation_rate
      FROM auction_stats
    `;

    // Competition metrics
    const competitionMetrics = await sql`
      WITH auction_competition AS (
        SELECT 
          tb.bid_number,
          COUNT(cb.id) as bid_count,
          COALESCE(MIN(cb.amount_cents), 0) as winning_bid,
          COALESCE(MAX(cb.amount_cents), 0) as highest_bid
        FROM telegram_bids tb
        LEFT JOIN carrier_bids cb ON tb.bid_number = cb.bid_number
        WHERE tb.tag = ${tag}
          AND tb.received_at >= ${startDate.toISOString()}
        GROUP BY tb.bid_number
      )
      SELECT 
        COUNT(CASE WHEN bid_count > 5 THEN 1 END) as high_competition_auctions,
        COUNT(CASE WHEN bid_count BETWEEN 2 AND 5 THEN 1 END) as moderate_competition_auctions,
        COUNT(CASE WHEN bid_count = 1 THEN 1 END) as single_bid_auctions,
        COUNT(CASE WHEN bid_count = 0 THEN 1 END) as no_bid_auctions,
        COALESCE(AVG(highest_bid - winning_bid), 0) as avg_bid_spread
      FROM auction_competition
    `;

    // Revenue metrics
    const revenueMetrics = await sql`
      SELECT 
        COALESCE(SUM(CASE WHEN cb.amount_cents = (
          SELECT MIN(cb2.amount_cents)
          FROM carrier_bids cb2
          WHERE cb2.bid_number = cb.bid_number
        ) THEN cb.amount_cents ELSE 0 END), 0) as total_revenue_potential,
        COALESCE(AVG(CASE WHEN cb.amount_cents = (
          SELECT MIN(cb2.amount_cents)
          FROM carrier_bids cb2
          WHERE cb2.bid_number = cb.bid_number
        ) THEN cb.amount_cents END), 0) as avg_winning_bid,
        COALESCE(MAX(cb.amount_cents), 0) as highest_bid
      FROM telegram_bids tb
      LEFT JOIN carrier_bids cb ON tb.bid_number = cb.bid_number
      WHERE tb.tag = ${tag}
        AND tb.received_at >= ${startDate.toISOString()}
        AND cb.id IS NOT NULL
    `;

    // Hourly trends
    const hourlyTrends = await sql`
      SELECT 
        EXTRACT(HOUR FROM tb.received_at) as hour,
        COUNT(tb.id) as auctions_created,
        COUNT(cb.id) as bids_placed
      FROM telegram_bids tb
      LEFT JOIN carrier_bids cb ON tb.bid_number = cb.bid_number
      WHERE tb.tag = ${tag}
        AND tb.received_at >= ${startDate.toISOString()}
      GROUP BY EXTRACT(HOUR FROM tb.received_at)
      ORDER BY hour
    `;

    // Distance breakdown
    const distanceBreakdown = await sql`
      SELECT 
        CASE 
          WHEN tb.distance_miles < 100 THEN 'Short (<100mi)'
          WHEN tb.distance_miles < 500 THEN 'Medium (100-500mi)'
          WHEN tb.distance_miles < 1000 THEN 'Long (500-1000mi)'
          ELSE 'Very Long (1000mi+)'
        END as distance_category,
        COUNT(tb.id) as auction_count,
        COUNT(cb.id) as bid_count,
        COALESCE(AVG(cb.amount_cents), 0) as avg_bid_amount,
        COALESCE(AVG(tb.distance_miles), 0) as avg_distance
      FROM telegram_bids tb
      LEFT JOIN carrier_bids cb ON tb.bid_number = cb.bid_number
      WHERE tb.tag = ${tag}
        AND tb.received_at >= ${startDate.toISOString()}
      GROUP BY distance_category
      ORDER BY avg_distance
    `;

    // Top carriers for this tag
    const topCarriers = await sql`
      SELECT 
        cp.company_name,
        cp.legal_name,
        cp.mc_number,
        COUNT(cb.id) as bid_count,
        COUNT(CASE WHEN aa.id IS NOT NULL THEN 1 END) as win_count,
        COALESCE(AVG(cb.amount_cents), 0) as avg_bid_amount
      FROM telegram_bids tb
      INNER JOIN carrier_bids cb ON tb.bid_number = cb.bid_number
      INNER JOIN carrier_profiles cp ON cb.supabase_user_id = cp.supabase_user_id
      LEFT JOIN auction_awards aa ON aa.bid_number = cb.bid_number 
        AND aa.supabase_winner_user_id = cp.supabase_user_id
      WHERE tb.tag = ${tag}
        AND tb.received_at >= ${startDate.toISOString()}
      GROUP BY cp.supabase_user_id, cp.company_name, cp.legal_name, cp.mc_number
      ORDER BY bid_count DESC, win_count DESC
      LIMIT 20
    `;

    logSecurityEvent('tag_analytics_accessed', userId, { tag, timeframe });
    
    const response = NextResponse.json({
      success: true,
      data: {
        summary: summary[0] || {},
        competitionMetrics: competitionMetrics[0] || {},
        revenueMetrics: revenueMetrics[0] || {},
        hourlyTrends,
        distanceBreakdown,
        topCarriers,
        timeframe: {
          days: Math.floor((new Date().getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)),
          startDate: startDate.toISOString(),
          endDate: new Date().toISOString()
        }
      }
    });
    
    return addSecurityHeaders(response);

  } catch (error: any) {
    console.error("Tag analytics API error:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('tag_analytics_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        success: false,
        error: "Failed to fetch tag analytics",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}

