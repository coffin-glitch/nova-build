import { requireApiAdmin } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

/**
 * API endpoint for carrier leaderboard grouped by MC/DOT number
 * Provides aggregate analytics for companies/fleets with multiple carriers
 */
export async function GET(request: NextRequest) {
  try {
    await requireApiAdmin(request);

    const { searchParams } = new URL(request.url);
    const timeframe = searchParams.get("timeframe") || "30";
    const limitParam = searchParams.get("limit") || "50";
    const limit = limitParam === "all" ? 1000 : Math.min(parseInt(limitParam), 1000);
    const sortBy = searchParams.get("sortBy") || "total_bids";
    const groupBy = searchParams.get("groupBy") || "mc"; // "mc" or "dot"
    const minCarriers = parseInt(searchParams.get("minCarriers") || "1");

    let startDate: Date | null = null;
    let daysAgo: number = 0;
    if (timeframe !== "all") {
      daysAgo = parseInt(timeframe);
      startDate = new Date();
      startDate.setDate(startDate.getDate() - daysAgo);
      startDate.setHours(0, 0, 0, 0);
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
            ${startDate ? sql`COUNT(CASE WHEN cb.created_at >= ${startDate} THEN 1 END)` : sql`COUNT(cb.id)`} as bids_in_timeframe,
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
            ${startDate ? sql`COUNT(CASE WHEN aa.awarded_at >= ${startDate} THEN 1 END)` : sql`COUNT(aa.id)`} as wins_in_timeframe,
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
              WHEN gbs.total_bids > 0 
              THEN ROUND((COALESCE(gws.total_wins, 0)::DECIMAL / gbs.total_bids * 100), 2)
              ELSE 0 
            END as win_rate_percentage,
            ROUND(COALESCE(gcs.avg_competitiveness_score, 0), 2) as competitiveness_score
          FROM group_bid_stats gbs
          LEFT JOIN group_win_stats gws ON gbs.group_identifier = gws.group_identifier
          LEFT JOIN group_competitiveness_stats gcs ON gbs.group_identifier = gcs.group_identifier
          LEFT JOIN top_carrier_per_group tcp ON gbs.group_identifier = tcp.group_identifier
          WHERE gbs.total_bids > 0
        )
        SELECT * FROM group_stats
        ORDER BY 
          CASE WHEN ${sortBy} = 'total_bids' THEN total_bids END DESC,
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
            ${startDate ? sql`COUNT(CASE WHEN cb.created_at >= ${startDate} THEN 1 END)` : sql`COUNT(cb.id)`} as bids_in_timeframe,
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
            ${startDate ? sql`COUNT(CASE WHEN aa.awarded_at >= ${startDate} THEN 1 END)` : sql`COUNT(aa.id)`} as wins_in_timeframe,
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
              WHEN gbs.total_bids > 0 
              THEN ROUND((COALESCE(gws.total_wins, 0)::DECIMAL / gbs.total_bids * 100), 2)
              ELSE 0 
            END as win_rate_percentage,
            ROUND(COALESCE(gcs.avg_competitiveness_score, 0), 2) as competitiveness_score
          FROM group_bid_stats gbs
          LEFT JOIN group_win_stats gws ON gbs.group_identifier = gws.group_identifier
          LEFT JOIN group_competitiveness_stats gcs ON gbs.group_identifier = gcs.group_identifier
          LEFT JOIN top_carrier_per_group tcp ON gbs.group_identifier = tcp.group_identifier
          WHERE gbs.total_bids > 0
        )
        SELECT * FROM group_stats
        ORDER BY 
          CASE WHEN ${sortBy} = 'total_bids' THEN total_bids END DESC,
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

    return NextResponse.json({
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

  } catch (error) {
    console.error("Carrier leaderboard grouped API error:", error);
    
    if (error instanceof Error) {
      if (error.message === "Unauthorized" || error.message.includes("Unauthorized")) {
        return NextResponse.json(
          { success: false, error: "Authentication required", details: error.message },
          { status: 401 }
        );
      }
      
      if (error.message === "Admin access required" || error.message.includes("Admin access")) {
        return NextResponse.json(
          { success: false, error: "Admin access required", details: error.message },
          { status: 403 }
        );
      }
    }
    
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch grouped leaderboard",
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

