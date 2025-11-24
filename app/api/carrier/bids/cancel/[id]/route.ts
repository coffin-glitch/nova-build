import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { requireApiCarrier, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// DELETE /api/carrier/bids/cancel/[id] - Cancel/delete a bid
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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
      return addRateLimitHeaders(addSecurityHeaders(response), rateLimit);
    }

    const { id } = await params;

    // Input validation
    const validation = validateInput(
      { id },
      {
        id: { required: true, type: 'string', pattern: /^\d+$/, maxLength: 50 }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_bid_cancel_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // First check if the bid exists and belongs to the user
    const bidCheck = await sql`
      SELECT cb.*, tb.received_at, tb.expires_at
      FROM carrier_bids cb
      LEFT JOIN telegram_bids tb ON cb.bid_number = tb.bid_number
      WHERE cb.id = ${id} AND cb.supabase_user_id = ${userId}
    `;

    if (bidCheck.length === 0) {
      return NextResponse.json(
        { error: "Bid not found" },
        { status: 404 }
      );
    }

    const bid = bidCheck[0];

    // Check if the auction is still active (within 25 minutes of posting)
    if (bid.received_at) {
      const receivedAt = new Date(bid.received_at);
      const expiresAt = new Date(receivedAt.getTime() + 25 * 60 * 1000); // 25 minutes
      const now = new Date();

      if (now > expiresAt) {
        return NextResponse.json(
          { error: "Cannot cancel bid - auction has expired" },
          { status: 400 }
        );
      }
    }

      // Delete the bid
      const result = await sql`
        DELETE FROM carrier_bids 
        WHERE id = ${id} AND supabase_user_id = ${userId}
        RETURNING id
      `;

    if (result.length === 0) {
      logSecurityEvent('bid_cancel_failed', userId, { bid_id: id });
      const response = NextResponse.json(
        { error: "Failed to cancel bid" },
        { status: 500 }
      );
      return addSecurityHeaders(response);
    }

    logSecurityEvent('bid_cancelled', userId, { bid_id: id, bid_number: bid.bid_number });
    
    const response = NextResponse.json({ 
      ok: true, 
      message: "Bid cancelled successfully" 
    });
    
    return addSecurityHeaders(response);

  } catch (error: any) {
    console.error('Error cancelling bid:', error);
    
    if (error.message === "Unauthorized" || error.message === "Carrier access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('bid_cancel_error', undefined, { 
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
    
    return addSecurityHeaders(response);
  }
}

