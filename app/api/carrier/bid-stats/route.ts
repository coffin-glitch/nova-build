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

    console.log(`[Bid Stats] Fetching for user: ${userId}`);

    // Get bid statistics for this carrier
    // Note: winner_user_id was removed in migration 078, only supabase_winner_user_id exists
    const stats = await sql`
      SELECT 
        COUNT(*) as total_awarded,
        COUNT(CASE WHEN COALESCE(cb.status, 'awarded') IN ('awarded', 'accepted', 'in_progress') THEN 1 END) as active_bids,
        COUNT(CASE WHEN COALESCE(cb.status, 'awarded') = 'completed' THEN 1 END) as completed_bids,
        COALESCE(SUM(aa.winner_amount_cents), 0) as total_revenue,
        COALESCE(AVG(aa.winner_amount_cents), 0) as average_amount
      FROM auction_awards aa
      LEFT JOIN carrier_bids cb ON aa.bid_number = cb.bid_number 
        AND cb.supabase_user_id = aa.supabase_winner_user_id
      WHERE aa.supabase_winner_user_id = ${userId}
    `;

    const result = stats[0] || {
      total_awarded: 0,
      active_bids: 0,
      completed_bids: 0,
      total_revenue: 0,
      average_amount: 0
    };

    console.log(`[Bid Stats] Result for user ${userId}:`, {
      total_awarded: result.total_awarded,
      active_bids: result.active_bids,
      completed_bids: result.completed_bids,
      total_revenue: result.total_revenue,
      average_amount: result.average_amount
    });

    logSecurityEvent('carrier_bid_stats_accessed', userId);
    
    const response = NextResponse.json({
      ok: true,
      data: {
        totalAwarded: parseInt(result.total_awarded) || 0,
        activeBids: parseInt(result.active_bids) || 0,
        completedBids: parseInt(result.completed_bids) || 0,
        totalRevenue: parseInt(result.total_revenue) || 0,
        averageAmount: parseInt(result.average_amount) || 0
      }
    });
    
    return addRateLimitHeaders(addSecurityHeaders(response), rateLimit);

  } catch (error: any) {
    console.error("Error fetching bid stats:", error);
    
    // Handle auth errors
    if (error.message === "Unauthorized" || error.message === "Carrier access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('carrier_bid_stats_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to fetch bid stats",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}
