import { addSecurityHeaders, logSecurityEvent } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

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
          error: 'Rate limit exceeded',
          message: `Too many requests. Please try again after ${rateLimit.retryAfter} seconds.`,
          retryAfter: rateLimit.retryAfter
        },
        { status: 429 }
      );
      return addRateLimitHeaders(addSecurityHeaders(response), rateLimit);
    }

    // Get basic offer statistics
    const basicStats = await sql`
      SELECT 
        COUNT(*) as total_offers,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_offers,
        COUNT(CASE WHEN status = 'accepted' THEN 1 END) as accepted_offers,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_offers,
        COUNT(CASE WHEN status = 'countered' THEN 1 END) as countered_offers,
        COUNT(CASE WHEN status = 'expired' THEN 1 END) as expired_offers,
        COALESCE(AVG(offer_amount), 0) as avg_offer_amount,
        COALESCE(MIN(offer_amount), 0) as min_offer_amount,
        COALESCE(MAX(offer_amount), 0) as max_offer_amount,
        COALESCE(SUM(offer_amount), 0) as total_offer_value
      FROM load_offers
    `;

    // Get acceptance rate
    const acceptanceRate = await sql`
      SELECT 
        CASE 
          WHEN COUNT(*) = 0 THEN 0
          ELSE ROUND(
            (COUNT(CASE WHEN status = 'accepted' THEN 1 END)::DECIMAL / COUNT(*)) * 100, 
            2
          )
        END as acceptance_rate
      FROM load_offers
      WHERE status IN ('accepted', 'rejected')
    `;

    // Get offers by month (last 12 months)
    const monthlyStats = await sql`
      SELECT 
        DATE_TRUNC('month', created_at) as month,
        COUNT(*) as total_offers,
        COUNT(CASE WHEN status = 'accepted' THEN 1 END) as accepted_offers,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_offers,
        COALESCE(AVG(offer_amount), 0) as avg_offer_amount
      FROM load_offers
      WHERE created_at >= NOW() - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY month DESC
    `;

    // Get top carriers by offer count
    const topCarriers = await sql`
      SELECT 
        cp.company_name,
        cp.legal_name,
        COUNT(lo.id) as offer_count,
        COUNT(CASE WHEN lo.status = 'accepted' THEN 1 END) as accepted_count,
        COALESCE(AVG(lo.offer_amount), 0) as avg_offer_amount,
        COALESCE(SUM(lo.offer_amount), 0) as total_offer_value
      FROM load_offers lo
      LEFT JOIN carrier_profiles cp ON lo.supabase_user_id = cp.supabase_user_id
      GROUP BY cp.company_name, cp.legal_name, lo.supabase_user_id
      ORDER BY offer_count DESC
      LIMIT 10
    `;

    // Get offers by equipment type
    const equipmentStats = await sql`
      SELECT 
        l.equipment,
        COUNT(lo.id) as offer_count,
        COUNT(CASE WHEN lo.status = 'accepted' THEN 1 END) as accepted_count,
        COALESCE(AVG(lo.offer_amount), 0) as avg_offer_amount
      FROM load_offers lo
      JOIN loads l ON lo.load_rr_number = l.rr_number
      GROUP BY l.equipment
      ORDER BY offer_count DESC
    `;

    // Get recent activity (last 7 days)
    const recentActivity = await sql`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as offers_created,
        COUNT(CASE WHEN status = 'accepted' THEN 1 END) as offers_accepted,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as offers_rejected
      FROM load_offers
      WHERE created_at >= NOW() - INTERVAL '7 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `;

    // Get average response time (time from offer creation to admin action)
    const responseTimeStats = await sql`
      SELECT 
        AVG(EXTRACT(EPOCH FROM (updated_at - created_at))/3600) as avg_response_hours,
        MIN(EXTRACT(EPOCH FROM (updated_at - created_at))/3600) as min_response_hours,
        MAX(EXTRACT(EPOCH FROM (updated_at - created_at))/3600) as max_response_hours
      FROM load_offers
      WHERE status IN ('accepted', 'rejected', 'countered')
      AND updated_at > created_at
    `;

    logSecurityEvent('offer_analytics_accessed', userId);
    
    const response = NextResponse.json({
      success: true,
      analytics: {
        basicStats: basicStats[0],
        acceptanceRate: acceptanceRate[0]?.acceptance_rate || 0,
        monthlyStats,
        topCarriers,
        equipmentStats,
        recentActivity,
        responseTimeStats: responseTimeStats[0] || {
          avg_response_hours: 0,
          min_response_hours: 0,
          max_response_hours: 0
        }
      }
    });
    
    return addRateLimitHeaders(addSecurityHeaders(response), rateLimit);

  } catch (error: any) {
    console.error("Error fetching offer analytics:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('offer_analytics_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Internal server error",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : String(error))
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}
