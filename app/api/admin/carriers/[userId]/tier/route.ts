import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import sql from "@/lib/db";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import { NextRequest, NextResponse } from "next/server";
import { redisConnection } from "@/lib/notification-queue";
import { clearCarrierRelatedCaches } from "@/lib/cache-invalidation";

// GET - Get user's current tier
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const auth = await requireApiAdmin(request);
    const adminUserId = auth.userId;

    // Check rate limit for admin read operation
    const rateLimit = await checkApiRateLimit(request, {
      userId: adminUserId,
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
    
    const { userId } = await params;

    // Input validation
    const validation = validateInput(
      { userId },
      {
        userId: { required: true, type: 'string', maxLength: 200 }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_carrier_tier_get_input', adminUserId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    const result = await sql`
      SELECT 
        COALESCE(cp.notification_tier, 'standard') as tier
      FROM carrier_profiles cp
      WHERE cp.supabase_user_id = ${userId}
      LIMIT 1
    `;

    if (result.length === 0) {
      logSecurityEvent('carrier_tier_not_found', adminUserId, { userId });
      const response = NextResponse.json(
        { error: "Carrier profile not found" },
        { status: 404 }
      );
      return addSecurityHeaders(response);
    }

    logSecurityEvent('carrier_tier_accessed', adminUserId, { carrierUserId: userId, tier: result[0].tier });
    
    const response = NextResponse.json({ 
      ok: true, 
      tier: result[0].tier || 'standard' 
    });
    
    return addRateLimitHeaders(addSecurityHeaders(response), rateLimit);
    
  } catch (error: any) {
    console.error("Error fetching user tier:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('carrier_tier_get_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json({ 
      error: "Failed to fetch tier",
      details: process.env.NODE_ENV === 'development' 
        ? (error instanceof Error ? error.message : 'Unknown error')
        : undefined
    }, { status: 500 });
    
    return addSecurityHeaders(response);
  }
}

// PUT - Update user's tier
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const auth = await requireApiAdmin(request);
    const adminUserId = auth.userId;
    
    const { userId } = await params;

    // Input validation for userId
    const userIdValidation = validateInput(
      { userId },
      {
        userId: { required: true, type: 'string', maxLength: 200 }
      }
    );

    if (!userIdValidation.valid) {
      logSecurityEvent('invalid_carrier_tier_update_userid', adminUserId, { errors: userIdValidation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${userIdValidation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    const body = await request.json();
    const { tier } = body;

    // Input validation for tier
    const tierValidation = validateInput(
      { tier },
      {
        tier: { required: true, type: 'string', enum: ['premium', 'standard', 'new'] }
      }
    );

    if (!tierValidation.valid) {
      logSecurityEvent('invalid_carrier_tier_update_body', adminUserId, { errors: tierValidation.errors });
      const response = NextResponse.json(
        { error: "Invalid tier. Must be 'premium', 'standard', or 'new'" },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // Update tier
    await sql`
      UPDATE carrier_profiles 
      SET notification_tier = ${tier}, updated_at = NOW()
      WHERE supabase_user_id = ${userId}
    `;

    // CRITICAL: Invalidate Redis cache so new tier takes effect immediately
    await redisConnection.del(`user_tier:${userId}`);
    
    // Clear other related caches
    await clearCarrierRelatedCaches(userId);

    logSecurityEvent('carrier_tier_updated', adminUserId, { carrierUserId: userId, newTier: tier });
    
    const response = NextResponse.json({ 
      ok: true, 
      tier,
      message: `Tier updated to ${tier}` 
    });
    
    return addSecurityHeaders(response);
    
  } catch (error: any) {
    console.error("Error updating user tier:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('carrier_tier_update_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json({ 
      error: "Failed to update tier",
      details: process.env.NODE_ENV === 'development' 
        ? (error instanceof Error ? error.message : 'Unknown error')
        : undefined
    }, { status: 500 });
    
    return addSecurityHeaders(response);
  }
}

