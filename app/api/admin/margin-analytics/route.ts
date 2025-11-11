import { requireApiAdmin } from '@/lib/auth-api-helper';
import sql from '@/lib/db';
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    await requireApiAdmin(request);
    
    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const stateTag = searchParams.get('stateTag');

    // Build date filter conditions
    const dateConditions: any[] = [];
    if (dateFrom) {
      dateConditions.push(sql`aa.awarded_at >= ${dateFrom}::date`);
    }
    if (dateTo) {
      dateConditions.push(sql`aa.awarded_at <= ${dateTo}::date + INTERVAL '1 day'`);
    }

    // Build state filter condition
    const stateCondition = stateTag ? sql`tb.tag = ${stateTag}` : null;

    // Build WHERE clause
    const whereConditions: any[] = [];
    if (dateConditions.length > 0) {
      whereConditions.push(sql`(${sql.join(dateConditions, sql` AND `)})`);
    }
    if (stateCondition) {
      whereConditions.push(stateCondition);
    }
    const whereClause = whereConditions.length > 0 
      ? sql`WHERE ${sql.join(whereConditions, sql` AND `)}`
      : sql``;

    // Overall Statistics
    const overallStats = await sql`
      SELECT 
        COUNT(*) FILTER (WHERE aa.margin_cents IS NOT NULL) as bids_with_margin,
        COUNT(*) as total_awards,
        COALESCE(SUM(aa.margin_cents), 0) as total_margin_cents,
        COALESCE(AVG(aa.margin_cents), 0) as avg_margin_cents,
        COALESCE(MIN(aa.margin_cents), 0) as min_margin_cents,
        COALESCE(MAX(aa.margin_cents), 0) as max_margin_cents,
        COALESCE(SUM(aa.winner_amount_cents), 0) as total_carrier_bid_cents,
        COALESCE(SUM(aa.winner_amount_cents + COALESCE(aa.margin_cents, 0)), 0) as total_submitted_cents
      FROM auction_awards aa
      LEFT JOIN telegram_bids tb ON aa.bid_number = tb.bid_number
      ${whereClause}
    `;

    // Margin by State
    const marginByState = await sql`
      SELECT 
        tb.tag as state,
        COUNT(*) as bid_count,
        COUNT(*) FILTER (WHERE aa.margin_cents IS NOT NULL) as bids_with_margin,
        COALESCE(SUM(aa.margin_cents), 0) as total_margin_cents,
        COALESCE(AVG(aa.margin_cents), 0) as avg_margin_cents,
        COALESCE(SUM(aa.winner_amount_cents), 0) as total_carrier_bid_cents,
        COALESCE(SUM(aa.winner_amount_cents + COALESCE(aa.margin_cents, 0)), 0) as total_submitted_cents
      FROM auction_awards aa
      LEFT JOIN telegram_bids tb ON aa.bid_number = tb.bid_number
      ${whereClause}
      GROUP BY tb.tag
      ORDER BY total_margin_cents DESC
    `;

    // Margin Trends (Daily)
    const marginTrends = await sql`
      SELECT 
        DATE(aa.awarded_at) as date,
        COUNT(*) as bid_count,
        COUNT(*) FILTER (WHERE aa.margin_cents IS NOT NULL) as bids_with_margin,
        COALESCE(SUM(aa.margin_cents), 0) as total_margin_cents,
        COALESCE(AVG(aa.margin_cents), 0) as avg_margin_cents
      FROM auction_awards aa
      LEFT JOIN telegram_bids tb ON aa.bid_number = tb.bid_number
      ${whereClause}
      GROUP BY DATE(aa.awarded_at)
      ORDER BY date DESC
      LIMIT 30
    `;

    // Margin Distribution (buckets)
    const marginDistribution = await sql`
      SELECT 
        CASE
          WHEN aa.margin_cents IS NULL THEN 'No Margin'
          WHEN aa.margin_cents = 0 THEN '$0'
          WHEN aa.margin_cents < 5000 THEN '$0-$50'
          WHEN aa.margin_cents < 10000 THEN '$50-$100'
          WHEN aa.margin_cents < 20000 THEN '$100-$200'
          WHEN aa.margin_cents < 50000 THEN '$200-$500'
          ELSE '$500+'
        END as margin_range,
        COUNT(*) as count,
        COALESCE(SUM(aa.margin_cents), 0) as total_margin_cents
      FROM auction_awards aa
      LEFT JOIN telegram_bids tb ON aa.bid_number = tb.bid_number
      ${whereClause}
      GROUP BY 
        CASE
          WHEN aa.margin_cents IS NULL THEN 'No Margin'
          WHEN aa.margin_cents = 0 THEN '$0'
          WHEN aa.margin_cents < 5000 THEN '$0-$50'
          WHEN aa.margin_cents < 10000 THEN '$50-$100'
          WHEN aa.margin_cents < 20000 THEN '$100-$200'
          WHEN aa.margin_cents < 50000 THEN '$200-$500'
          ELSE '$500+'
        END
      ORDER BY 
        MIN(
          CASE
            WHEN aa.margin_cents IS NULL THEN 0
            WHEN aa.margin_cents = 0 THEN 1
            WHEN aa.margin_cents < 5000 THEN 2
            WHEN aa.margin_cents < 10000 THEN 3
            WHEN aa.margin_cents < 20000 THEN 4
            WHEN aa.margin_cents < 50000 THEN 5
            ELSE 6
          END
        )
    `;

    // Top Routes by Margin
    const topRoutes = await sql`
      SELECT 
        tb.bid_number,
        tb.tag as state,
        tb.distance_miles,
        COALESCE(aa.margin_cents, 0) as margin_cents,
        aa.winner_amount_cents as carrier_bid_cents,
        aa.winner_amount_cents + COALESCE(aa.margin_cents, 0) as submitted_cents,
        aa.awarded_at,
        CASE 
          WHEN aa.winner_amount_cents > 0 
          THEN ROUND((COALESCE(aa.margin_cents, 0)::numeric / aa.winner_amount_cents::numeric) * 100, 2)
          ELSE 0
        END as margin_percentage
      FROM auction_awards aa
      LEFT JOIN telegram_bids tb ON aa.bid_number = tb.bid_number
      ${whereClause} AND aa.margin_cents IS NOT NULL
      ORDER BY aa.margin_cents DESC
      LIMIT 20
    `;

    // Margin Efficiency (margin per mile)
    const marginEfficiency = await sql`
      SELECT 
        tb.tag as state,
        COUNT(*) as bid_count,
        COALESCE(SUM(aa.margin_cents), 0) as total_margin_cents,
        COALESCE(SUM(tb.distance_miles), 0) as total_miles,
        CASE 
          WHEN SUM(tb.distance_miles) > 0 
          THEN ROUND((SUM(aa.margin_cents)::numeric / SUM(tb.distance_miles)::numeric), 2)
          ELSE 0
        END as margin_per_mile_cents
      FROM auction_awards aa
      LEFT JOIN telegram_bids tb ON aa.bid_number = tb.bid_number
      ${whereClause} AND aa.margin_cents IS NOT NULL AND tb.distance_miles > 0
      GROUP BY tb.tag
      ORDER BY margin_per_mile_cents DESC
    `;

    // Weekly/Monthly Aggregates
    const weeklyStats = await sql`
      SELECT 
        DATE_TRUNC('week', aa.awarded_at) as week_start,
        COUNT(*) as bid_count,
        COUNT(*) FILTER (WHERE aa.margin_cents IS NOT NULL) as bids_with_margin,
        COALESCE(SUM(aa.margin_cents), 0) as total_margin_cents,
        COALESCE(AVG(aa.margin_cents), 0) as avg_margin_cents
      FROM auction_awards aa
      LEFT JOIN telegram_bids tb ON aa.bid_number = tb.bid_number
      ${whereClause}
      GROUP BY DATE_TRUNC('week', aa.awarded_at)
      ORDER BY week_start DESC
      LIMIT 12
    `;

    const monthlyStats = await sql`
      SELECT 
        DATE_TRUNC('month', aa.awarded_at) as month_start,
        COUNT(*) as bid_count,
        COUNT(*) FILTER (WHERE aa.margin_cents IS NOT NULL) as bids_with_margin,
        COALESCE(SUM(aa.margin_cents), 0) as total_margin_cents,
        COALESCE(AVG(aa.margin_cents), 0) as avg_margin_cents
      FROM auction_awards aa
      LEFT JOIN telegram_bids tb ON aa.bid_number = tb.bid_number
      ${whereClause}
      GROUP BY DATE_TRUNC('month', aa.awarded_at)
      ORDER BY month_start DESC
      LIMIT 12
    `;

    // Admin Performance (who's adding the most margin)
    const adminPerformance = await sql`
      SELECT 
        COALESCE(ap.display_name, ap.display_email, ur.email, aa.supabase_awarded_by::text) as admin_name,
        COUNT(*) as bid_count,
        COUNT(*) FILTER (WHERE aa.margin_cents IS NOT NULL) as bids_with_margin,
        COALESCE(SUM(aa.margin_cents), 0) as total_margin_cents,
        COALESCE(AVG(aa.margin_cents), 0) as avg_margin_cents
      FROM auction_awards aa
      LEFT JOIN telegram_bids tb ON aa.bid_number = tb.bid_number
      LEFT JOIN user_roles_cache ur ON aa.supabase_awarded_by = ur.supabase_user_id
      LEFT JOIN admin_profiles ap ON aa.supabase_awarded_by = ap.supabase_user_id
      ${whereClause}
      GROUP BY admin_name, aa.supabase_awarded_by
      ORDER BY total_margin_cents DESC
    `;

    return NextResponse.json({
      success: true,
      data: {
        overall: overallStats[0] || {},
        byState: marginByState,
        trends: marginTrends,
        distribution: marginDistribution,
        topRoutes: topRoutes,
        efficiency: marginEfficiency,
        weekly: weeklyStats,
        monthly: monthlyStats,
        adminPerformance: adminPerformance
      }
    });

  } catch (error) {
    console.error("Margin analytics error:", error);
    return NextResponse.json(
      { error: "Failed to fetch margin analytics" },
      { status: 500 }
    );
  }
}

