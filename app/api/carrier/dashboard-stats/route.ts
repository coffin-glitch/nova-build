import { addSecurityHeaders, logSecurityEvent } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { requireApiCarrier, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiCarrier(request);
    const userId = auth.userId;

    // Check rate limit for read-only carrier operation
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

    // Get comprehensive dashboard stats
    const stats = await sql`
      WITH bid_stats AS (
        SELECT 
          COUNT(*) as total_bids,
          COUNT(CASE WHEN cb.created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as bids_last_30_days,
          COUNT(CASE WHEN tb.is_archived = false AND NOW() <= (tb.received_at::timestamp + INTERVAL '25 minutes') THEN 1 END) as active_bids,
          COUNT(CASE WHEN cb.bid_outcome = 'won' THEN 1 END) as won_bids,
          COUNT(CASE WHEN cb.bid_outcome = 'lost' THEN 1 END) as lost_bids,
          COUNT(CASE WHEN cb.bid_outcome = 'pending' OR cb.bid_outcome IS NULL THEN 1 END) as pending_bids
        FROM carrier_bids cb
        LEFT JOIN telegram_bids tb ON cb.bid_number = tb.bid_number
        WHERE cb.supabase_user_id = ${userId}
      ),
      award_stats AS (
        SELECT 
          COUNT(*) as total_awarded,
          COALESCE(SUM(aa.winner_amount_cents), 0) as total_revenue,
          COALESCE(AVG(aa.winner_amount_cents), 0) as avg_award_amount,
          COUNT(CASE WHEN COALESCE(cb.status, 'awarded') IN ('awarded', 'accepted', 'in_progress') THEN 1 END) as active_awards,
          COUNT(CASE WHEN COALESCE(cb.status, 'awarded') = 'completed' THEN 1 END) as completed_awards
        FROM auction_awards aa
        LEFT JOIN carrier_bids cb ON aa.bid_number = cb.bid_number 
          AND cb.supabase_user_id = aa.supabase_winner_user_id
        WHERE aa.supabase_winner_user_id = ${userId}
      ),
      favorite_stats AS (
        SELECT 
          COUNT(*) as total_favorites,
          COUNT(CASE WHEN tb.is_archived = false AND NOW() <= (tb.received_at::timestamp + INTERVAL '25 minutes') THEN 1 END) as active_favorites
        FROM carrier_favorites cf
        LEFT JOIN telegram_bids tb ON cf.bid_number = tb.bid_number
        WHERE cf.supabase_carrier_user_id = ${userId}
      )
      SELECT 
        bs.total_bids,
        bs.bids_last_30_days,
        bs.active_bids,
        bs.won_bids,
        bs.lost_bids,
        bs.pending_bids,
        aws.total_awarded,
        aws.total_revenue,
        aws.avg_award_amount,
        aws.active_awards,
        aws.completed_awards,
        fs.total_favorites,
        fs.active_favorites
      FROM bid_stats bs
      CROSS JOIN award_stats aws
      CROSS JOIN favorite_stats fs
    `;

    const result = stats[0] || {
      total_bids: 0,
      bids_last_30_days: 0,
      active_bids: 0,
      won_bids: 0,
      lost_bids: 0,
      pending_bids: 0,
      total_awarded: 0,
      total_revenue: 0,
      avg_award_amount: 0,
      active_awards: 0,
      completed_awards: 0,
      total_favorites: 0,
      active_favorites: 0
    };

    logSecurityEvent('carrier_dashboard_stats_accessed', userId);
    
    const response = NextResponse.json({
      ok: true,
      data: {
        totalBids: parseInt(result.total_bids) || 0,
        bidsLast30Days: parseInt(result.bids_last_30_days) || 0,
        activeBids: parseInt(result.active_bids) || 0,
        wonBids: parseInt(result.won_bids) || 0,
        lostBids: parseInt(result.lost_bids) || 0,
        pendingBids: parseInt(result.pending_bids) || 0,
        totalAwarded: parseInt(result.total_awarded) || 0,
        totalRevenue: parseInt(result.total_revenue) || 0,
        avgAwardAmount: parseInt(result.avg_award_amount) || 0,
        activeAwards: parseInt(result.active_awards) || 0,
        completedAwards: parseInt(result.completed_awards) || 0,
        totalFavorites: parseInt(result.total_favorites) || 0,
        activeFavorites: parseInt(result.active_favorites) || 0
      }
    });
    
    return addRateLimitHeaders(addSecurityHeaders(response), rateLimit);

  } catch (error: any) {
    console.error("Error fetching dashboard stats:", error);
    
    if (error.message === "Unauthorized" || error.message === "Carrier access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('carrier_dashboard_stats_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to fetch dashboard statistics",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}

