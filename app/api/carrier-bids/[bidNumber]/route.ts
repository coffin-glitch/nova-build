import { addRateLimitHeaders, checkApiRateLimit } from "@/lib/api-rate-limiting";
import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { requireApiCarrier, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ bidNumber: string }> }
) {
  try {
    // Ensure user is carrier (Supabase-only)
    const auth = await requireApiCarrier(request);
    const userId = auth.userId;

    // Check rate limit for authenticated write operation (delete is critical)
    const rateLimit = await checkApiRateLimit(request, {
      userId,
      routeType: 'critical'
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

    const { bidNumber } = await params;

    // Input validation
    const validation = validateInput(
      { bidNumber },
      {
        bidNumber: { required: true, type: 'string', pattern: /^[A-Z0-9\-_]+$/, maxLength: 100 }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_carrier_bid_cancel_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response, request);
    }

    if (!bidNumber) {
      const response = NextResponse.json(
        { error: "Bid number is required" },
        { status: 400 }
      );
      return addSecurityHeaders(response, request);
    }

    // Check if the carrier has a bid for this auction (Supabase-only)
    const existingBid = await sql`
      SELECT id, bid_number, supabase_user_id, amount_cents, notes, created_at
      FROM carrier_bids 
      WHERE bid_number = ${bidNumber} AND supabase_user_id = ${userId}
    `;

    if (existingBid.length === 0) {
      logSecurityEvent('carrier_bid_cancel_not_found', userId, { bidNumber });
      const response = NextResponse.json(
        { error: "Bid not found or already cancelled" },
        { status: 404 }
      );
      return addSecurityHeaders(response, request);
    }

    // Delete the carrier's bid (Supabase-only)
    const result = await sql`
      DELETE FROM carrier_bids 
      WHERE bid_number = ${bidNumber} AND supabase_user_id = ${userId}
    `;

    if (result.length === 0) {
      logSecurityEvent('carrier_bid_cancel_failed', userId, { bidNumber });
      const response = NextResponse.json(
        { error: "Bid not found or already cancelled" },
        { status: 404 }
      );
      return addSecurityHeaders(response, request);
    }

    logSecurityEvent('carrier_bid_cancelled', userId, { bidNumber });
    
    const response = NextResponse.json({
      success: true,
      message: `Bid ${bidNumber} cancelled successfully`
    });
    
    return addSecurityHeaders(response, request);

  } catch (error: any) {
    console.error("Cancel bid error:", error);
    
    if (error.message === "Unauthorized" || error.message === "Carrier access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('carrier_bid_cancel_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      {
        error: "Failed to cancel bid",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response, request);
  }
}
