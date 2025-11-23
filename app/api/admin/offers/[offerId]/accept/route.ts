import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const AcceptSchema = z.object({
  accepted_price: z.coerce.number().positive().optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ offerId: string }> }) {
  try {
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
          ok: false,
          error: 'Rate limit exceeded',
          message: `Too many requests. Please try again after ${rateLimit.retryAfter} seconds.`,
          retryAfter: rateLimit.retryAfter
        },
        { status: 429 }
      );
      return addRateLimitHeaders(addSecurityHeaders(response), rateLimit);
    }
    
    const { offerId } = await params;

    // Input validation
    const validation = validateInput(
      { offerId },
      {
        offerId: { required: true, type: 'string', pattern: /^\d+$/, maxLength: 20 }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_offer_accept_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { ok: false, error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    const id = Number(offerId);
    
    // Validate offerId is a valid number
    if (isNaN(id) || id <= 0) {
      logSecurityEvent('invalid_offer_accept_id', userId, { offerId });
      const response = NextResponse.json(
        { ok: false, error: "Invalid offer ID" },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }
    
    const body = await request.json().catch(() => ({}));
    const parse = AcceptSchema.safeParse(body);
    if (!parse.success) {
      const response = NextResponse.json(
        { ok: false, errors: parse.error.flatten() },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    const offerRows = await sql`SELECT load_rr_number, supabase_user_id FROM load_offers WHERE id = ${id} LIMIT 1`;
    if (!offerRows.length) {
      logSecurityEvent('offer_accept_not_found', userId, { offerId: id });
      const response = NextResponse.json(
        { ok: false, error: "Offer not found" },
        { status: 404 }
      );
      return addSecurityHeaders(response);
    }

    const { load_rr_number, supabase_user_id } = offerRows[0] as any;
    const accepted_price = parse.data.accepted_price ?? null;

    await sql.begin(async (trx) => {
      await trx`UPDATE load_offers SET status='accepted', updated_at=NOW() WHERE id = ${id}`;
      await trx`
        INSERT INTO assignments (load_rr_number, supabase_user_id, accepted_price)
        VALUES (${load_rr_number}, ${supabase_user_id}, ${accepted_price})
      `;
    });

    logSecurityEvent('offer_accepted', userId, { offerId: id, loadRrNumber: load_rr_number });
    
    const response = NextResponse.json({ ok: true });
    
    return addRateLimitHeaders(addSecurityHeaders(response), rateLimit);
    
  } catch (error: any) {
    console.error("Error accepting offer:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('offer_accept_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        ok: false,
        error: "Failed to accept offer",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}
