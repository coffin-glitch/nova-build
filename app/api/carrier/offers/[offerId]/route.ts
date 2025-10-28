import sql from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ offerId: string }> }
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { offerId } = await params;
    const body = await request.json();
    const { action, offerAmount, notes } = body;

    if (!action || (action === 'modify' && !offerAmount)) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // First, verify the offer belongs to this carrier and is in a modifiable state
    const existingOffer = await sql`
      SELECT id, status, offer_amount, notes, load_rr_number
      FROM load_offers 
      WHERE id = ${offerId} AND carrier_user_id = ${userId}
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
        WHERE id = ${offerId} AND carrier_user_id = ${userId}
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

      return NextResponse.json({
        ok: true,
        message: offer.status === 'countered' ? "Counter-offer sent successfully" : "Offer updated successfully",
        offer: result[0]
      });

    } else if (action === 'withdraw') {
      // Update the offer status to withdrawn
      const result = await sql`
        UPDATE load_offers 
        SET 
          status = 'withdrawn',
          updated_at = NOW()
        WHERE id = ${offerId} AND carrier_user_id = ${userId}
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

      return NextResponse.json({
        ok: true,
        message: "Offer withdrawn successfully",
        offer: result[0]
      });

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
        WHERE id = ${offerId} AND carrier_user_id = ${userId}
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

      return NextResponse.json({
        ok: true,
        message: "Counter-offer accepted successfully",
        offer: result[0]
      });

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
        WHERE id = ${offerId} AND carrier_user_id = ${userId}
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

      return NextResponse.json({
        ok: true,
        message: "Counter-offer rejected successfully",
        offer: result[0]
      });

    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

  } catch (error) {
    console.error("Error updating carrier offer:", error);
    return NextResponse.json(
      { error: "Failed to update offer", details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // First, verify the offer belongs to this carrier and is in a deletable state
    const existingOffer = await sql`
      SELECT id, status, load_rr_number
      FROM load_offers 
      WHERE id = ${offerId} AND carrier_user_id = ${userId}
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
      WHERE id = ${offerId} AND carrier_user_id = ${userId}
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

    return NextResponse.json({
      ok: true,
      message: "Offer deleted successfully"
    });

  } catch (error) {
    console.error("Error deleting carrier offer:", error);
    return NextResponse.json(
      { error: "Failed to delete offer", details: error.message },
      { status: 500 }
    );
  }
}
