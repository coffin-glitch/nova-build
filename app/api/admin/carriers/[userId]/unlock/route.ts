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
          ok: false,
          error: 'Rate limit exceeded',
          message: `Too many requests. Please try again after ${rateLimit.retryAfter} seconds.`,
          retryAfter: rateLimit.retryAfter
        },
        { status: 429 }
      );
      return addRateLimitHeaders(addSecurityHeaders(response), rateLimit);
    }

    const { userId: carrierUserId } = await params;

    // Input validation
    const validation = validateInput(
      { carrierUserId },
      {
        carrierUserId: { required: true, type: 'string', maxLength: 200 }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_carrier_unlock_input', adminUserId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // Unlock carrier profile (Supabase-only)
    await sql`
      UPDATE carrier_profiles SET
        is_locked = false,
        locked_at = NULL,
        locked_by = NULL,
        lock_reason = NULL
      WHERE supabase_user_id = ${carrierUserId}
    `;

    logSecurityEvent('carrier_profile_unlocked', adminUserId, { carrierUserId });
    
    const response = NextResponse.json({ 
      ok: true, 
      message: "Profile unlocked successfully" 
    });
    
    return addSecurityHeaders(response);

  } catch (error: any) {
    console.error("Error unlocking carrier profile:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('carrier_unlock_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json({ 
      error: "Failed to unlock profile",
      details: process.env.NODE_ENV === 'development' 
        ? (error instanceof Error ? error.message : 'Unknown error')
        : undefined
    }, { status: 500 });
    
    return addSecurityHeaders(response);
  }
}
