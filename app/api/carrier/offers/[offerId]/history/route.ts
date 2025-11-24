import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { requireApiCarrier, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ offerId: string }> }
) {
  try {
    const auth = await requireApiCarrier(request);
    const userId = auth.userId;

    // Check rate limit for authenticated read operation
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

    const { offerId } = await params;
    const id = offerId;

    // Input validation
    const validation = validateInput(
      { offerId },
      {
        offerId: { required: true, type: 'string', maxLength: 50 }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_offer_history_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // Verify the offer belongs to this carrier
    const offerCheck = await sql`
      SELECT id FROM load_offers 
      WHERE id = ${id} AND supabase_user_id = ${userId}
    `;

    if (offerCheck.length === 0) {
      logSecurityEvent('offer_history_unauthorized', userId, { offerId });
      const response = NextResponse.json(
        { error: "Offer not found" },
        { status: 404 }
      );
      return addSecurityHeaders(response);
    }

    // Get offer history with user information
    const history = await sql`
      SELECT 
        oh.*,
        urc.email as performed_by_email,
        urc.role as performed_by_role
      FROM offer_history oh
      LEFT JOIN user_roles_cache urc ON oh.performed_by = urc.supabase_user_id
      WHERE oh.offer_id = ${id}
      ORDER BY oh.performed_at DESC
    `;

    logSecurityEvent('carrier_offer_history_accessed', userId, { offerId });
    
    const response = NextResponse.json({
      ok: true,
      history: history
    });
    
    return addSecurityHeaders(response);

  } catch (error: any) {
    console.error("Error fetching carrier offer history:", error);
    
    if (error.message === "Unauthorized" || error.message === "Carrier access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('carrier_offer_history_error', undefined, { 
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
