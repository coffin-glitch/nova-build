import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// Lightweight in-memory cache (30s TTL) to collapse bursts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const g: any = globalThis as any;
g.__grouped_leader_cache = g.__grouped_leader_cache || new Map<string, { t: number; v: any }>();

/**
 * API endpoint for carrier leaderboard grouped by MC/DOT number
 * Provides aggregate analytics for companies/fleets with multiple carriers
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiAdmin(request);
    const userId = auth.userId;

    // Check rate limit for admin read operation
    const rateLimit = await checkApiRateLimit(request, {
      userId,
      routeType: 'readOnly'
    });

    if (!rateLimit.allowed) {
      const response = NextResponse.json(
        {
          success: false,
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
    const groupBy = searchParams.get("groupBy") || "mc"; // "mc" or "dot"
    const minCarriers = parseInt(searchParams.get("minCarriers") || "1");

    // Input validation
    const validation = validateInput(
      { timeframe, startDateParam, endDateParam, limitParam, sortBy, groupBy, minCarriers },
      {
        timeframe: { type: 'string', maxLength: 20, required: false },
        startDateParam: { type: 'string', pattern: /^\d{4}-\d{2}-\d{2}$/, maxLength: 10, required: false },
        endDateParam: { type: 'string', pattern: /^\d{4}-\d{2}-\d{2}$/, maxLength: 10, required: false },
        limitParam: { type: 'string', maxLength: 10, required: false },
        sortBy: { type: 'string', enum: ['total_bids', 'win_rate', 'total_revenue', 'carriers_count', 'avg_bid'], required: false },
        groupBy: { type: 'string', enum: ['mc', 'dot'], required: false },
        minCarriers: { type: 'number', min: 1, max: 100, required: false }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_leaderboard_grouped_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { success: false, error: `Invalid input: ${validation.errors.join(', ')}` },
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
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date();
      endDate.setHours(23, 59, 59, 999);
    }

    // Build query based on groupBy - postgres.js doesn't support dynamic columns
    let groupedData;
    
    if (groupBy === "dot") {
      groupedData = await sql`
        WITH carrier_groups AS (
          SELECT 
            cp.supabase_user_id,
            COALESCE(cp.dot_number, 'UNKNOWN') as group_identifier,
            COALESCE(cp.company_name, cp.legal_name, 'Unknown') as company_name,
            cp.legal_name,
            cp.mc_number,
            cp.dot_number
          FROM carrier_profiles cp
          WHERE cp.dot_number IS NOT NULL AND cp.dot_number != ''
        ),
        group_bid_stats AS (
          SELECT 
            cg.group_identifier,
            COUNT(cb.id) as total_bids,
            COUNT(CASE 
              ${startDate && endDate ? sql`WHEN cb.created_at >= ${startDate} AND cb.created_at <= ${endDate} THEN 1` : startDate ? sql`WHEN cb.created_at >= ${startDate} THEN 1` : sql`WHEN 1=1 THEN 1`}
            END) as bids_in_timeframe,
            COUNT(DISTINCT cb.bid_number) as unique_auctions,
            COUNT(DISTINCT cg.supabase_user_id) as carriers_count,
            COALESCE(AVG(cb.amount_cents), 0)::INTEGER as avg_bid_amount_cents,
            COALESCE(SUM(cb.amount_cents), 0) as total_bid_value_cents
          FROM carrier_groups cg
          LEFT JOIN carrier_bids cb ON cg.supabase_user_id = cb.supabase_user_id
          GROUP BY cg.group_identifier
          HAVING COUNT(DISTINCT cg.supabase_user_id) >= ${minCarriers}
        ),
        group_win_stats AS (
          SELECT 
            cg.group_identifier,
            COUNT(aa.id) as total_wins,
            COUNT(CASE 
              ${startDate && endDate ? sql`WHEN aa.awarded_at >= ${startDate} AND aa.awarded_at <= ${endDate} THEN 1` : startDate ? sql`WHEN aa.awarded_at >= ${startDate} THEN 1` : sql`WHEN 1=1 THEN 1`}
            END) as wins_in_timeframe,
            COALESCE(AVG(aa.winner_amount_cents), 0)::INTEGER as avg_winning_bid_cents,
            COALESCE(SUM(aa.winner_amount_cents), 0) as total_revenue_cents
          FROM carrier_groups cg
          LEFT JOIN auction_awards aa ON cg.supabase_user_id = aa.supabase_winner_user_id
          GROUP BY cg.group_identifier
        ),
        individual_competitiveness AS (
          SELECT 
            cb.supabase_user_id,
            COUNT(*) as total_bids,
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
        carrier_competitiveness_scores AS (
          SELECT 
            cg.group_identifier,
            cg.supabase_user_id,
            CASE 
              WHEN ic.total_bids > 0 
              THEN ROUND((COALESCE(ic.bids_within_5_percent, 0)::DECIMAL / ic.total_bids * 100), 2)
              ELSE 0 
            END as competitiveness_score
          FROM carrier_groups cg
          LEFT JOIN individual_competitiveness ic ON cg.supabase_user_id = ic.supabase_user_id
        ),
        group_competitiveness_stats AS (
          SELECT 
            ccs.group_identifier,
            COALESCE(AVG(ccs.competitiveness_score), 0)::DECIMAL as avg_competitiveness_score
          FROM carrier_competitiveness_scores ccs
          GROUP BY ccs.group_identifier
        ),
        top_carrier_per_group AS (
          SELECT DISTINCT ON (cg.group_identifier)
            cg.group_identifier,
            cg.supabase_user_id,
            cg.company_name,
            cg.legal_name,
            COUNT(CASE WHEN aa.id IS NOT NULL THEN 1 END) as carrier_wins,
            COALESCE(SUM(aa.winner_amount_cents), 0) as carrier_revenue
          FROM carrier_groups cg
          LEFT JOIN auction_awards aa ON cg.supabase_user_id = aa.supabase_winner_user_id
            ${startDate && endDate ? sql`AND (aa.awarded_at >= ${startDate} AND aa.awarded_at <= ${endDate})` : startDate ? sql`AND aa.awarded_at >= ${startDate}` : sql``}
          GROUP BY cg.group_identifier, cg.supabase_user_id, cg.company_name, cg.legal_name
          ORDER BY cg.group_identifier, carrier_wins DESC, carrier_revenue DESC
        ),
        group_stats AS (
          SELECT 
            gbs.group_identifier,
            gbs.total_bids,
            gbs.bids_in_timeframe,
            gbs.unique_auctions,
            gbs.carriers_count,
            gbs.avg_bid_amount_cents,
            gbs.total_bid_value_cents,
            COALESCE(gws.total_wins, 0) as total_wins,
            COALESCE(gws.wins_in_timeframe, 0) as wins_in_timeframe,
            COALESCE(gws.avg_winning_bid_cents, 0) as avg_winning_bid_cents,
            COALESCE(gws.total_revenue_cents, 0) as total_revenue_cents,
            tcp.supabase_user_id as top_carrier_user_id,
            tcp.company_name as top_carrier_name,
            tcp.legal_name as top_carrier_legal_name,
            tcp.carrier_wins as top_carrier_wins,
            CASE 
              WHEN gbs.bids_in_timeframe > 0 
              THEN ROUND((COALESCE(gws.wins_in_timeframe, 0)::DECIMAL / gbs.bids_in_timeframe * 100), 2)
              ELSE 0 
            END as win_rate_percentage,
            ROUND(COALESCE(gcs.avg_competitiveness_score, 0), 2) as competitiveness_score
          FROM group_bid_stats gbs
          LEFT JOIN group_win_stats gws ON gbs.group_identifier = gws.group_identifier
          LEFT JOIN group_competitiveness_stats gcs ON gbs.group_identifier = gcs.group_identifier
          LEFT JOIN top_carrier_per_group tcp ON gbs.group_identifier = tcp.group_identifier
          WHERE gbs.bids_in_timeframe > 0
        )
        SELECT * FROM group_stats
        ORDER BY 
          CASE WHEN ${sortBy} = 'total_bids' THEN bids_in_timeframe END DESC,
          CASE WHEN ${sortBy} = 'win_rate' THEN win_rate_percentage END DESC,
          CASE WHEN ${sortBy} = 'total_revenue' THEN total_revenue_cents END DESC,
          CASE WHEN ${sortBy} = 'carriers_count' THEN carriers_count END DESC,
          CASE WHEN ${sortBy} = 'avg_bid' THEN avg_bid_amount_cents END ASC
        LIMIT ${limit}
      `;
    } else {
      // MC number grouping
      groupedData = await sql`
        WITH carrier_groups AS (
          SELECT 
            cp.supabase_user_id,
            COALESCE(cp.mc_number, 'UNKNOWN') as group_identifier,
            COALESCE(cp.company_name, cp.legal_name, 'Unknown') as company_name,
            cp.legal_name,
            cp.mc_number,
            cp.dot_number
          FROM carrier_profiles cp
          WHERE cp.mc_number IS NOT NULL AND cp.mc_number != ''
        ),
        group_bid_stats AS (
          SELECT 
            cg.group_identifier,
            COUNT(cb.id) as total_bids,
            COUNT(CASE 
              ${startDate && endDate ? sql`WHEN cb.created_at >= ${startDate} AND cb.created_at <= ${endDate} THEN 1` : startDate ? sql`WHEN cb.created_at >= ${startDate} THEN 1` : sql`WHEN 1=1 THEN 1`}
            END) as bids_in_timeframe,
            COUNT(DISTINCT cb.bid_number) as unique_auctions,
            COUNT(DISTINCT cg.supabase_user_id) as carriers_count,
            COALESCE(AVG(cb.amount_cents), 0)::INTEGER as avg_bid_amount_cents,
            COALESCE(SUM(cb.amount_cents), 0) as total_bid_value_cents
          FROM carrier_groups cg
          LEFT JOIN carrier_bids cb ON cg.supabase_user_id = cb.supabase_user_id
          GROUP BY cg.group_identifier
          HAVING COUNT(DISTINCT cg.supabase_user_id) >= ${minCarriers}
        ),
        group_win_stats AS (
          SELECT 
            cg.group_identifier,
            COUNT(aa.id) as total_wins,
            COUNT(CASE 
              ${startDate && endDate ? sql`WHEN aa.awarded_at >= ${startDate} AND aa.awarded_at <= ${endDate} THEN 1` : startDate ? sql`WHEN aa.awarded_at >= ${startDate} THEN 1` : sql`WHEN 1=1 THEN 1`}
            END) as wins_in_timeframe,
            COALESCE(AVG(aa.winner_amount_cents), 0)::INTEGER as avg_winning_bid_cents,
            COALESCE(SUM(aa.winner_amount_cents), 0) as total_revenue_cents
          FROM carrier_groups cg
          LEFT JOIN auction_awards aa ON cg.supabase_user_id = aa.supabase_winner_user_id
          GROUP BY cg.group_identifier
        ),
        individual_competitiveness AS (
          SELECT 
            cb.supabase_user_id,
            COUNT(*) as total_bids,
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
        carrier_competitiveness_scores AS (
          SELECT 
            cg.group_identifier,
            cg.supabase_user_id,
            CASE 
              WHEN ic.total_bids > 0 
              THEN ROUND((COALESCE(ic.bids_within_5_percent, 0)::DECIMAL / ic.total_bids * 100), 2)
              ELSE 0 
            END as competitiveness_score
          FROM carrier_groups cg
          LEFT JOIN individual_competitiveness ic ON cg.supabase_user_id = ic.supabase_user_id
        ),
        group_competitiveness_stats AS (
          SELECT 
            ccs.group_identifier,
            COALESCE(AVG(ccs.competitiveness_score), 0)::DECIMAL as avg_competitiveness_score
          FROM carrier_competitiveness_scores ccs
          GROUP BY ccs.group_identifier
        ),
        top_carrier_per_group AS (
          SELECT DISTINCT ON (cg.group_identifier)
            cg.group_identifier,
            cg.supabase_user_id,
            cg.company_name,
            cg.legal_name,
            COUNT(CASE WHEN aa.id IS NOT NULL THEN 1 END) as carrier_wins,
            COALESCE(SUM(aa.winner_amount_cents), 0) as carrier_revenue
          FROM carrier_groups cg
          LEFT JOIN auction_awards aa ON cg.supabase_user_id = aa.supabase_winner_user_id
            ${startDate && endDate ? sql`AND (aa.awarded_at >= ${startDate} AND aa.awarded_at <= ${endDate})` : startDate ? sql`AND aa.awarded_at >= ${startDate}` : sql``}
          GROUP BY cg.group_identifier, cg.supabase_user_id, cg.company_name, cg.legal_name
          ORDER BY cg.group_identifier, carrier_wins DESC, carrier_revenue DESC
        ),
        group_stats AS (
          SELECT 
            gbs.group_identifier,
            gbs.total_bids,
            gbs.bids_in_timeframe,
            gbs.unique_auctions,
            gbs.carriers_count,
            gbs.avg_bid_amount_cents,
            gbs.total_bid_value_cents,
            COALESCE(gws.total_wins, 0) as total_wins,
            COALESCE(gws.wins_in_timeframe, 0) as wins_in_timeframe,
            COALESCE(gws.avg_winning_bid_cents, 0) as avg_winning_bid_cents,
            COALESCE(gws.total_revenue_cents, 0) as total_revenue_cents,
            tcp.supabase_user_id as top_carrier_user_id,
            tcp.company_name as top_carrier_name,
            tcp.legal_name as top_carrier_legal_name,
            tcp.carrier_wins as top_carrier_wins,
            CASE 
              WHEN gbs.bids_in_timeframe > 0 
              THEN ROUND((COALESCE(gws.wins_in_timeframe, 0)::DECIMAL / gbs.bids_in_timeframe * 100), 2)
              ELSE 0 
            END as win_rate_percentage,
            ROUND(COALESCE(gcs.avg_competitiveness_score, 0), 2) as competitiveness_score
          FROM group_bid_stats gbs
          LEFT JOIN group_win_stats gws ON gbs.group_identifier = gws.group_identifier
          LEFT JOIN group_competitiveness_stats gcs ON gbs.group_identifier = gcs.group_identifier
          LEFT JOIN top_carrier_per_group tcp ON gbs.group_identifier = tcp.group_identifier
          WHERE gbs.bids_in_timeframe > 0
        )
        SELECT * FROM group_stats
        ORDER BY 
          CASE WHEN ${sortBy} = 'total_bids' THEN bids_in_timeframe END DESC,
          CASE WHEN ${sortBy} = 'win_rate' THEN win_rate_percentage END DESC,
          CASE WHEN ${sortBy} = 'total_revenue' THEN total_revenue_cents END DESC,
          CASE WHEN ${sortBy} = 'carriers_count' THEN carriers_count END DESC,
          CASE WHEN ${sortBy} = 'avg_bid' THEN avg_bid_amount_cents END ASC
        LIMIT ${limit}
      `;
    }

    // Get carriers for each group
    const groupsWithCarriers = await Promise.all(
      groupedData.map(async (group: any) => {
        const groupIdentifier = group.group_identifier;
        
        let carriers;
        if (groupBy === "dot") {
          carriers = await sql`
            SELECT 
              cp.supabase_user_id,
              cp.company_name,
              cp.legal_name,
              cp.mc_number,
              cp.dot_number,
              COUNT(cb.id)::INTEGER as carrier_bids,
              COUNT(CASE WHEN aa.id IS NOT NULL THEN 1 END)::INTEGER as carrier_wins,
              COALESCE(SUM(aa.winner_amount_cents), 0)::BIGINT as carrier_revenue
            FROM carrier_profiles cp
            LEFT JOIN carrier_bids cb ON cp.supabase_user_id = cb.supabase_user_id
            LEFT JOIN auction_awards aa ON cp.supabase_user_id = aa.supabase_winner_user_id
            WHERE cp.dot_number = ${groupIdentifier}
            GROUP BY cp.supabase_user_id, cp.company_name, cp.legal_name, cp.mc_number, cp.dot_number
            ORDER BY carrier_wins DESC, carrier_revenue DESC
          `;
        } else {
          carriers = await sql`
            SELECT 
              cp.supabase_user_id,
              cp.company_name,
              cp.legal_name,
              cp.mc_number,
              cp.dot_number,
              COUNT(cb.id)::INTEGER as carrier_bids,
              COUNT(CASE WHEN aa.id IS NOT NULL THEN 1 END)::INTEGER as carrier_wins,
              COALESCE(SUM(aa.winner_amount_cents), 0)::BIGINT as carrier_revenue
            FROM carrier_profiles cp
            LEFT JOIN carrier_bids cb ON cp.supabase_user_id = cb.supabase_user_id
            LEFT JOIN auction_awards aa ON cp.supabase_user_id = aa.supabase_winner_user_id
            WHERE cp.mc_number = ${groupIdentifier}
            GROUP BY cp.supabase_user_id, cp.company_name, cp.legal_name, cp.mc_number, cp.dot_number
            ORDER BY carrier_wins DESC, carrier_revenue DESC
          `;
        }
        
        return {
          ...group,
          carriers: carriers || []
        };
      })
    );

    logSecurityEvent('carrier_leaderboard_grouped_accessed', userId, { 
      groupBy,
      sortBy,
      limit,
      timeframe: timeframe || 'custom'
    });
    
    const response = NextResponse.json({
      success: true,
      data: {
        groups: groupsWithCarriers,
        groupBy: groupBy,
        timeframe: {
          days: daysAgo,
          startDate: startDate?.toISOString() || 'all time',
          endDate: new Date().toISOString()
        },
        sortBy: sortBy,
        limit: limit
      }
    });
    
    return addRateLimitHeaders(addSecurityHeaders(response), rateLimit);

  } catch (error: any) {
    console.error("Carrier leaderboard grouped API error:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('carrier_leaderboard_grouped_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      {
        success: false,
        error: "Failed to fetch grouped leaderboard",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}

