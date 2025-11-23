import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const auth = await requireApiAdmin(request);
    const adminUserId = auth.userId;

    // Check rate limit for admin write operation
    const rateLimit = await checkApiRateLimit(request, {
      userId: adminUserId,
      routeType: 'admin'
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

    const { userId: carrierUserId } = await params;

    // Input validation for userId
    const userIdValidation = validateInput(
      { carrierUserId },
      {
        carrierUserId: { required: true, type: 'string', maxLength: 200 }
      }
    );

    if (!userIdValidation.valid) {
      logSecurityEvent('invalid_carrier_lock_userid', adminUserId, { errors: userIdValidation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${userIdValidation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    const body = await request.json();
    const { reason } = body;

    // Input validation for body
    const bodyValidation = validateInput(
      { reason },
      {
        reason: { type: 'string', maxLength: 500, required: false }
      }
    );

    if (!bodyValidation.valid) {
      logSecurityEvent('invalid_carrier_lock_body', adminUserId, { errors: bodyValidation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${bodyValidation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // Lock carrier profile (Supabase-only)
    await sql`
      UPDATE carrier_profiles SET
        is_locked = true,
        locked_at = CURRENT_TIMESTAMP,
        locked_by = ${adminUserId},
        lock_reason = ${reason || null}
      WHERE supabase_user_id = ${carrierUserId}
    `;

    logSecurityEvent('carrier_profile_locked', adminUserId, { carrierUserId, reason: reason || null });
    
    const response = NextResponse.json({ 
      ok: true, 
      message: "Profile locked successfully" 
    });
    
    return addRateLimitHeaders(addSecurityHeaders(response), rateLimit);

  } catch (error: any) {
    console.error("Error locking carrier profile:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('carrier_lock_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json({ 
      error: "Failed to lock profile",
      details: process.env.NODE_ENV === 'development' 
        ? (error instanceof Error ? error.message : 'Unknown error')
        : undefined
    }, { status: 500 });
    
    return addSecurityHeaders(response);
  }
}
