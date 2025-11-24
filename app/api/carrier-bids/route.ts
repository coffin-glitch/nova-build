import { addRateLimitHeaders, checkApiRateLimit } from "@/lib/api-rate-limiting";
import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { getCarrierProfile, upsertCarrierBid, validateCarrierProfileComplete } from "@/lib/auctions";
import { requireApiCarrier, unauthorizedResponse } from "@/lib/auth-api-helper";
import { validateMoneyInput } from "@/lib/format";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    // Ensure user is carrier (Supabase-only)
    const auth = await requireApiCarrier(request);
    const userId = auth.userId;

    // Validate request size
    const { validateRequestSize, getMaxSizeForContentType } = await import('@/lib/api-security');
    const contentType = request.headers.get('content-type');
    const maxSize = getMaxSizeForContentType(contentType);
    const sizeError = await validateRequestSize(request, maxSize);
    if (sizeError) {
      return sizeError;
    }

    // Check rate limit for critical operation (bid submission)
    const rateLimit = await checkApiRateLimit(request, {
      userId,
      routeType: 'critical'
    });

    if (!rateLimit.allowed) {
      const response = NextResponse.json(
        {
          ok: false,
          error: 'Rate limit exceeded',
          message: `Too many bid submissions. Please try again after ${rateLimit.retryAfter} seconds.`,
          retryAfter: rateLimit.retryAfter
        },
        { status: 429 }
      );
      return addRateLimitHeaders(addSecurityHeaders(response, request), rateLimit);
    }

    const body = await request.json();
    const { bid_number, amount, notes } = body;

    // Input validation
    const validation = validateInput(
      { bid_number, amount, notes },
      {
        bid_number: { required: true, type: 'string', pattern: /^[A-Z0-9\-_]+$/, maxLength: 100 },
        amount: { required: true, type: 'number', min: 0.01, max: 1000000 },
        notes: { type: 'string', maxLength: 1000, required: false }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_carrier_bid_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { ok: false, error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response, request);
    }

    if (!bid_number || !amount) {
      const response = NextResponse.json(
        { ok: false, error: "Missing required fields: bid_number, amount" },
        { status: 400 }
      );
      return addSecurityHeaders(response, request);
    }

    // Validate money input
    const moneyValidation = validateMoneyInput(amount.toString());
    if (!moneyValidation.isValid) {
      return NextResponse.json(
        { ok: false, error: moneyValidation.error },
        { status: 400 }
      );
    }

    const amount_cents = moneyValidation.cents!;

    // Ensure carrier profile exists
    await getCarrierProfile(userId);

    // Validate that carrier profile is 100% complete before allowing bidding
    const profileValidation = await validateCarrierProfileComplete(userId);
    if (!profileValidation.isComplete) {
      const missingFieldsText = profileValidation.missingFields.join(', ');
      return NextResponse.json(
        { ok: false, error: `Profile incomplete. Please complete the following required fields: ${missingFieldsText}. Go to your profile page to update your information.` },
        { status: 400 }
      );
    }

    const bid = await upsertCarrierBid({
      bid_number,
      userId,
      amount_cents,
      notes,
    });

    logSecurityEvent('carrier_bid_created', userId, { 
      bidNumber: bid_number,
      amountCents: amount_cents
    });
    
    const response = NextResponse.json({
      ok: true,
      data: bid,
    });
    
    return addRateLimitHeaders(addSecurityHeaders(response, request), rateLimit);
    
  } catch (error: any) {
    console.error("Carrier bid API error:", error);
    
    if (error.message === "Unauthorized" || error.message === "Carrier access required") {
      return unauthorizedResponse();
    }
    
    if (error.message.includes("Auction closed")) {
      const response = NextResponse.json(
        { ok: false, error: "Auction closed - bidding period has expired" },
        { status: 409 }
      );
      return addSecurityHeaders(response, request);
    }

    logSecurityEvent('carrier_bid_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        ok: false, 
        error: process.env.NODE_ENV === 'development' 
          ? error.message
          : "Failed to create bid"
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response, request);
  }
}

export async function GET(request: NextRequest) {
  try {
    // Ensure user is carrier (Supabase-only)
    const auth = await requireApiCarrier(request);
    const userId = auth.userId;

    // Get user's carrier profile and bids
    const profile = await getCarrierProfile(userId);
    
    if (!profile) {
      return NextResponse.json({
        ok: true,
        data: {
          profile: null,
          bids: [],
        },
      });
    }

    // TODO: Implement getting user's bids summary
    // This would require a new function in auctions.ts

    logSecurityEvent('carrier_bids_accessed', userId);
    
    const response = NextResponse.json({
      ok: true,
      data: {
        profile,
        bids: [],
      },
    });
    
    return addSecurityHeaders(response, request);
    
  } catch (error: any) {
    console.error("Carrier bids GET API error:", error);
    
    if (error.message === "Unauthorized" || error.message === "Carrier access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('carrier_bids_fetch_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        ok: false, 
        error: process.env.NODE_ENV === 'development' 
          ? error.message
          : "Failed to fetch bids"
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response, request);
  }
}
