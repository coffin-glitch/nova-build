import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { requireApiCarrier, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// GET list offers for a load
export async function GET(
  request: NextRequest
) {
  try {
    // Require authentication for viewing offers
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
    
    const { searchParams } = new URL(request.url);
    const rr = searchParams.get('rrNumber');
    
    // Input validation
    const validation = validateInput(
      { rr },
      {
        rr: { required: true, type: 'string', pattern: /^[A-Z0-9\-_]+$/, maxLength: 100 }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_load_offers_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }
    
    if (!rr) {
      const response = NextResponse.json(
        { error: "rrNumber parameter is required" },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // Get offers (Supabase-only)
    const offers = await sql`
      SELECT o.id, o.amount_cents, o.note, o.created_at, o.supabase_user_id as user_id
      FROM load_offers o
      WHERE o.load_rr_number = ${rr}
      ORDER BY o.offer_amount ASC, o.created_at ASC
      LIMIT 500
    `;
    
    const response = NextResponse.json({ offers });
    return addSecurityHeaders(response);
    
  } catch (error: any) {
    console.error("Error fetching load offers:", error);
    
    if (error.message === "Unauthorized" || error.message === "Carrier access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('load_offers_fetch_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        offers: [],
        error: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : "Failed to fetch offers"
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}

// POST place offer
export async function POST(
  request: NextRequest
) {
  try {
    // Ensure user is carrier (Supabase-only)
    const auth = await requireApiCarrier(request);
    const userId = auth.userId;
    
    const { searchParams } = new URL(request.url);
    const rr = searchParams.get('rrNumber');
    
    const body = await request.json().catch(()=>({}));
    const amount = Number(body.amount);
    const note = (body.note || "").toString().slice(0, 500);
    
    // Input validation
    const validation = validateInput(
      { rr, amount, note },
      {
        rr: { required: true, type: 'string', pattern: /^[A-Z0-9\-_]+$/, maxLength: 100 },
        amount: { required: true, type: 'number', min: 0.01, max: 1000000 },
        note: { type: 'string', maxLength: 500, required: false }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_load_offer_create_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }
    
    if (!rr) {
      const response = NextResponse.json(
        { error: "rrNumber parameter is required" },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      const response = NextResponse.json(
        { error: "Invalid amount" },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // Insert offer (Supabase-only)
    const inserted = await sql`
      INSERT INTO load_offers (load_rr_number, supabase_user_id, offer_amount, notes)
      VALUES (${rr}, ${userId}, ${Math.round(amount * 100)}, ${note})
      RETURNING id, load_rr_number, supabase_user_id as user_id, offer_amount as amount_cents, notes as note, created_at
    `;
    
    logSecurityEvent('load_offer_created', userId, { 
      rrNumber: rr,
      amount: Math.round(amount * 100)
    });
    
    const response = NextResponse.json(inserted[0], { status: 201 });
    return addSecurityHeaders(response);
    
  } catch (error: any) {
    console.error("Error creating load offer:", error);
    
    if (error.message === "Unauthorized" || error.message === "Carrier access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('load_offer_create_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to create offer",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}
