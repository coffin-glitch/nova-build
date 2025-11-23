import { addSecurityHeaders, logSecurityEvent } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // Ensure user is admin (Supabase-only)
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
          error: 'Rate limit exceeded',
          message: `Too many requests. Please try again after ${rateLimit.retryAfter} seconds.`,
          retryAfter: rateLimit.retryAfter
        },
        { status: 429 }
      );
      return addRateLimitHeaders(addSecurityHeaders(response), rateLimit);
    }

    // Get bid statistics
    // Use LEFT JOIN to include awarded bids even if carrier hasn't accepted yet
    // Note: winner_user_id was removed in migration 078, only supabase_winner_user_id exists
    const stats = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN COALESCE(cb.status, 'awarded') = 'active' THEN 1 END) as active,
        COUNT(CASE WHEN COALESCE(cb.status, 'awarded') = 'completed' THEN 1 END) as completed,
        COALESCE(SUM(aa.winner_amount_cents), 0) as revenue
      FROM auction_awards aa
      LEFT JOIN carrier_bids cb ON aa.bid_number = cb.bid_number AND aa.supabase_winner_user_id = cb.supabase_user_id
    `;

    const result = stats[0] || { total: 0, active: 0, completed: 0, revenue: 0 };

    logSecurityEvent('admin_bid_stats_accessed', userId);
    
    const response = NextResponse.json({
      total: parseInt(result.total) || 0,
      active: parseInt(result.active) || 0,
      completed: parseInt(result.completed) || 0,
      revenue: parseInt(result.revenue) || 0
    });
    
    return addRateLimitHeaders(addSecurityHeaders(response), rateLimit);
    
  } catch (error: any) {
    console.error("Error fetching bid stats:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('admin_bid_stats_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to fetch bid statistics",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}
