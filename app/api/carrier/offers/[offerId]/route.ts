import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { requireApiCarrier, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ offerId: string }> }
) {
  try {
    const auth = await requireApiCarrier(request);
    const userId = auth.userId;

    // Check rate limit for authenticated write operation
    const rateLimit = await checkApiRateLimit(request, {
      userId,
      routeType: 'authenticated'
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
    const body = await request.json();
    const { action, offerAmount, notes } = body;

    // Input validation
    const validation = validateInput(
      { offerId, action, offerAmount, notes },
      {
        offerId: { required: true, type: 'string', maxLength: 200 },
        action: { 
          required: true, 
          type: 'string', 
          enum: ['modify', 'withdraw', 'accept_counter', 'reject_counter']
        },
        offerAmount: { type: 'number', min: 0, required: false },
        notes: { type: 'string', maxLength: 1000, required: false }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_offer_update_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    if (!action || (action === 'modify' && !offerAmount)) {
      const response = NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // First, verify the offer belongs to this carrier and is in a modifiable state
    const existingOffer = await sql`
      SELECT id, status, offer_amount, notes, load_rr_number
      FROM load_offers 
      WHERE id = ${offerId} AND supabase_user_id = ${userId}
    `;

    if (existingOffer.length === 0) {
      return NextResponse.json({ error: "Offer not found" }, { status: 404 });
    }

    const offer = existingOffer[0];

    // Allow modification/withdrawal of pending offers, and counter-offer responses for countered offers
    if (offer.status !== 'pending' && offer.status !== 'countered') {
      return NextResponse.json({ 
        error: "Only pending or countered offers can be modified" 
      }, { status: 400 });
    }

    if (action === 'modify') {
      // Validate offer amount
      const amount = parseFloat(offerAmount);
      if (isNaN(amount) || amount <= 0) {
        return NextResponse.json({ 
          error: "Invalid offer amount" 
        }, { status: 400 });
      }

      // Convert to cents
      const amountInCents = Math.round(amount * 100);

      // Update the offer - if it's a countered offer, reset status to pending
      const result = await sql`
        UPDATE load_offers 
        SET 
          offer_amount = ${amountInCents},
          notes = ${notes || ''},
          status = CASE 
            WHEN status = 'countered' THEN 'pending'
            ELSE status
          END,
          counter_amount = NULL,
          updated_at = NOW()
        WHERE id = ${offerId} AND supabase_user_id = ${userId}
        RETURNING id, offer_amount, notes, status, updated_at
      `;

      if (result.length === 0) {
        return NextResponse.json({ error: "Failed to update offer" }, { status: 500 });
      }

      // Record in offer history
      const historyAction = offer.status === 'countered' ? 'countered_back' : 'modified';
      await sql`
        INSERT INTO offer_history (offer_id, action, old_amount, new_amount, carrier_notes, performed_by)
        VALUES (${offerId}, ${historyAction}, ${offer.offer_amount}, ${amountInCents}, ${notes || ''}, ${userId})
      `;

      logSecurityEvent('offer_modified', userId, { 
        offerId, 
        action: 'modify', 
        oldAmount: offer.offer_amount, 
        newAmount: amountInCents 
      });
      
      const response = NextResponse.json({
        ok: true,
        message: offer.status === 'countered' ? "Counter-offer sent successfully" : "Offer updated successfully",
        offer: result[0]
      });
      
      return addSecurityHeaders(response);

    } else if (action === 'withdraw') {
      // Update the offer status to withdrawn
      const result = await sql`
        UPDATE load_offers 
        SET 
          status = 'withdrawn',
          updated_at = NOW()
        WHERE id = ${offerId} AND supabase_user_id = ${userId}
        RETURNING id, status, updated_at
      `;

      if (result.length === 0) {
        return NextResponse.json({ error: "Failed to withdraw offer" }, { status: 500 });
      }

      // Record in offer history
      await sql`
        INSERT INTO offer_history (offer_id, action, old_status, new_status, performed_by)
        VALUES (${offerId}, 'withdrawn', 'pending', 'withdrawn', ${userId})
      `;

      logSecurityEvent('offer_withdrawn', userId, { offerId });
      
      const response = NextResponse.json({
        ok: true,
        message: "Offer withdrawn successfully",
        offer: result[0]
      });
      
      return addSecurityHeaders(response);

    } else if (action === 'accept_counter') {
      // Only allow accepting counter-offers for countered offers
      if (offer.status !== 'countered') {
        return NextResponse.json({ 
          error: "Can only accept counter-offers for countered offers" 
        }, { status: 400 });
      }

      // Update the offer status to accepted
      const result = await sql`
        UPDATE load_offers 
        SET 
          status = 'accepted',
          offer_amount = counter_amount,
          updated_at = NOW()
        WHERE id = ${offerId} AND supabase_user_id = ${userId}
        RETURNING id, status, offer_amount, updated_at
      `;

      if (result.length === 0) {
        return NextResponse.json({ error: "Failed to accept counter-offer" }, { status: 500 });
      }

      // Record in offer history
      await sql`
        INSERT INTO offer_history (offer_id, action, old_status, new_status, performed_by)
        VALUES (${offerId}, 'accepted_counter', 'countered', 'accepted', ${userId})
      `;

      logSecurityEvent('counter_offer_accepted', userId, { offerId });
      
      const response = NextResponse.json({
        ok: true,
        message: "Counter-offer accepted successfully",
        offer: result[0]
      });
      
      return addSecurityHeaders(response);

    } else if (action === 'reject_counter') {
      // Only allow rejecting counter-offers for countered offers
      if (offer.status !== 'countered') {
        return NextResponse.json({ 
          error: "Can only reject counter-offers for countered offers" 
        }, { status: 400 });
      }

      // Update the offer status to rejected
      const result = await sql`
        UPDATE load_offers 
        SET 
          status = 'rejected',
          updated_at = NOW()
        WHERE id = ${offerId} AND supabase_user_id = ${userId}
        RETURNING id, status, updated_at
      `;

      if (result.length === 0) {
        return NextResponse.json({ error: "Failed to reject counter-offer" }, { status: 500 });
      }

      // Record in offer history
      await sql`
        INSERT INTO offer_history (offer_id, action, old_status, new_status, performed_by)
        VALUES (${offerId}, 'rejected_counter', 'countered', 'rejected', ${userId})
      `;

      logSecurityEvent('counter_offer_rejected', userId, { offerId });
      
      const response = NextResponse.json({
        ok: true,
        message: "Counter-offer rejected successfully",
        offer: result[0]
      });
      
      return addSecurityHeaders(response);

    } else {
      const response = NextResponse.json(
        { error: "Invalid action" },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

  } catch (error: any) {
    console.error("Error updating carrier offer:", error);
    
    if (error.message === "Unauthorized" || error.message === "Carrier access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('offer_update_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to update offer",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : String(error))
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ offerId: string }> }
) {
  try {
    const auth = await requireApiCarrier(request);
    const userId = auth.userId;

    const { offerId } = await params;

    // Input validation
    const validation = validateInput(
      { offerId },
      {
        offerId: { required: true, type: 'string', maxLength: 200 }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_offer_delete_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // First, verify the offer belongs to this carrier and is in a deletable state
    const existingOffer = await sql`
      SELECT id, status, load_rr_number
      FROM load_offers 
      WHERE id = ${offerId} AND supabase_user_id = ${userId}
    `;

    if (existingOffer.length === 0) {
      return NextResponse.json({ error: "Offer not found" }, { status: 404 });
    }

    const offer = existingOffer[0];

    // Only allow deletion of pending offers
    if (offer.status !== 'pending') {
      return NextResponse.json({ 
        error: "Only pending offers can be deleted" 
      }, { status: 400 });
    }

    // Delete the offer
    const result = await sql`
      DELETE FROM load_offers 
      WHERE id = ${offerId} AND supabase_user_id = ${userId}
      RETURNING id, load_rr_number
    `;

    if (result.length === 0) {
      return NextResponse.json({ error: "Failed to delete offer" }, { status: 500 });
    }

    // Record in offer history
    await sql`
      INSERT INTO offer_history (offer_id, action, old_status, performed_by)
      VALUES (${offerId}, 'deleted', 'pending', ${userId})
    `;

    logSecurityEvent('offer_deleted', userId, { offerId, loadRrNumber: offer.load_rr_number });
    
    const response = NextResponse.json({
      ok: true,
      message: "Offer deleted successfully"
    });
    
    return addSecurityHeaders(response);

  } catch (error: any) {
    console.error("Error deleting carrier offer:", error);
    
    if (error.message === "Unauthorized" || error.message === "Carrier access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('offer_delete_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to delete offer",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : String(error))
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}
