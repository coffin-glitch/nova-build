import { addSecurityHeaders, logSecurityEvent } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    // Require admin authentication for expiration operations
    const auth = await requireApiAdmin(request);
    const userId = auth.userId;

    // Check rate limit for admin write operation
    const rateLimit = await checkApiRateLimit(request, {
      userId,
      routeType: 'admin'
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
    // Mark expired offers as expired
    // Only update if expires_at and is_expired columns exist
    // Check if columns exist first
    const hasExpiresAt = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'load_offers' AND column_name = 'expires_at'
      LIMIT 1
    `;
    
    if (hasExpiresAt.length === 0) {
      // expires_at column doesn't exist, skip expiration logic
      const response = NextResponse.json({ 
        success: true, 
        expiredCount: 0,
        message: 'Expiration not configured (expires_at column not found)' 
      });
      return addSecurityHeaders(response);
    }
    
    const result = await sql`
      UPDATE load_offers 
      SET is_expired = true, status = 'expired'
      WHERE expires_at < NOW() 
      AND status = 'pending' 
      AND is_expired = false
      RETURNING id, load_rr_number, supabase_carrier_user_id, carrier_user_id
    `;

    // Create notifications for expired offers (Supabase-only)
    if (result && result.length > 0) {
      for (const offer of result) {
        const carrierSupabaseUserId = offer.supabase_carrier_user_id || offer.carrier_user_id;
        
        await sql`
          INSERT INTO carrier_notifications (
            supabase_user_id,
            carrier_user_id,
            type,
            title,
            message,
            is_read,
            created_at
          ) VALUES (
            ${carrierSupabaseUserId},
            ${offer.carrier_user_id},
            'offer_expired',
            'Offer Expired',
            'Your offer for load ${offer.load_rr_number} has expired and is no longer active.',
            false,
            NOW()
          )
        `;
      }
    }

    logSecurityEvent('offers_expired', userId, { expiredCount: result.length });
    
    const response = NextResponse.json({ 
      success: true, 
      expiredCount: result.length,
      message: `Expired ${result.length} offers` 
    });
    
    return addRateLimitHeaders(addSecurityHeaders(response), rateLimit);

  } catch (error: any) {
    console.error("Error expiring offers:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('offers_expire_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Internal server error",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}

export async function GET(request: NextRequest) {
  try {
    // Require admin authentication for expiration stats
    const auth = await requireApiAdmin(request);
    const userId = auth.userId;
    // Check if expires_at column exists
    const hasExpiresAt = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'load_offers' AND column_name = 'expires_at'
      LIMIT 1
    `;
    
    if (hasExpiresAt.length === 0) {
      // expires_at column doesn't exist
      const response = NextResponse.json({ 
        expiringSoon: 0,
        expired: 0
      });
      return addSecurityHeaders(response);
    }
    
    // Get count of offers that will expire soon (within 1 hour)
    const expiringSoon = await sql`
      SELECT COUNT(*) as count
      FROM load_offers 
      WHERE expires_at BETWEEN NOW() AND NOW() + INTERVAL '1 hour'
      AND status = 'pending' 
      AND is_expired = false
    `;

    // Get count of already expired offers
    const expired = await sql`
      SELECT COUNT(*) as count
      FROM load_offers 
      WHERE expires_at < NOW()
      AND status = 'pending' 
      AND is_expired = false
    `;

    const response = NextResponse.json({ 
      expiringSoon: parseInt(expiringSoon[0].count),
      expired: parseInt(expired[0].count)
    });
    
    return addSecurityHeaders(response);

  } catch (error: any) {
    console.error("Error getting expiration stats:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('offers_expire_stats_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Internal server error",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}
