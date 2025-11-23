import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const CounterSchema = z.object({
  counter_price: z.coerce.number().positive(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ offerId: string }> }) {
  try {
    const auth = await requireApiAdmin(request);
    const userId = auth.userId;
    
    const { offerId } = await params;

    // Input validation
    const validation = validateInput(
      { offerId },
      {
        offerId: { required: true, type: 'string', pattern: /^\d+$/, maxLength: 20 }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_offer_counter_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { ok: false, error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    const id = Number(offerId);
    
    // Validate offerId is a valid number
    if (isNaN(id) || id <= 0) {
      logSecurityEvent('invalid_offer_counter_id', userId, { offerId });
      const response = NextResponse.json(
        { ok: false, error: "Invalid offer ID" },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }
    
    const body = await request.json().catch(() => ({}));
    const parse = CounterSchema.safeParse(body);
    if (!parse.success) {
      const response = NextResponse.json(
        { ok: false, errors: parse.error.flatten() },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    await sql`
      UPDATE load_offers
      SET status='counter', notes = COALESCE(notes,'') || E'\n[Counter] ' || ${parse.data.counter_price}, updated_at=NOW()
      WHERE id = ${id}
    `;
    
    logSecurityEvent('offer_countered', userId, { offerId: id, counterPrice: parse.data.counter_price });
    
    const response = NextResponse.json({ ok: true });
    
    return addSecurityHeaders(response);
    
  } catch (error: any) {
    console.error("Error countering offer:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('offer_counter_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        ok: false,
        error: "Failed to counter offer",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}
