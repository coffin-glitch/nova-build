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
      return addRateLimitHeaders(addSecurityHeaders(response, request), rateLimit);
    }

    // Get awarded bids for this carrier
    console.log(`[Carrier Awarded Bids] Fetching for user: ${userId}`);
    
    // Note: winner_user_id and awarded_by were removed in migration 078
    // Only supabase_winner_user_id and supabase_awarded_by exist now
    // IMPORTANT: margin_cents is NEVER exposed to carriers - admin-only analytics data
    const awardedBids = await sql`
      SELECT 
        aa.id,
        aa.bid_number,
        aa.supabase_winner_user_id as winner_user_id,
        aa.winner_amount_cents,
        aa.supabase_awarded_by as awarded_by,
        COALESCE(ap.display_name, ap.display_email, ur.email, aa.supabase_awarded_by::text) as awarded_by_name,
        aa.awarded_at,
        tb.distance_miles,
        tb.pickup_timestamp,
        tb.delivery_timestamp,
        tb.stops,
        tb.tag,
        tb.source_channel,
        COALESCE(cb.status, 'awarded') as status,
        cb.lifecycle_notes as notes,
        cb.updated_at
        -- margin_cents is intentionally excluded - admin-only analytics data
      FROM auction_awards aa
      LEFT JOIN telegram_bids tb ON aa.bid_number = tb.bid_number
      LEFT JOIN carrier_bids cb ON aa.bid_number = cb.bid_number 
        AND cb.supabase_user_id = aa.supabase_winner_user_id
      LEFT JOIN user_roles_cache ur ON aa.supabase_awarded_by = ur.supabase_user_id
      LEFT JOIN admin_profiles ap ON aa.supabase_awarded_by = ap.supabase_user_id
      WHERE aa.supabase_winner_user_id = ${userId}
      ORDER BY aa.awarded_at DESC
    `;

    console.log(`[Carrier Awarded Bids] Found ${awardedBids.length} bids for user ${userId}`);
    console.log(`[Carrier Awarded Bids] Bid numbers: ${awardedBids.map(b => b.bid_number).join(', ')}`);

    logSecurityEvent('carrier_awarded_bids_accessed', userId);
    
    const response = NextResponse.json({ 
      ok: true, 
      data: awardedBids 
    });
    
    return addRateLimitHeaders(addSecurityHeaders(response, request), rateLimit);

  } catch (error: any) {
    console.error("Error fetching awarded bids:", error);
    
    // Handle auth errors
    if (error.message === "Unauthorized" || error.message === "Carrier access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('carrier_awarded_bids_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to fetch awarded bids",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response, request);
  }
}
