import { requireAdmin } from "@/lib/clerk-server";
import sql from "@/lib/db";
import { NextResponse } from "next/server";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ offerId: string }> }
) {
  try {
    // This will redirect if user is not admin
    await requireAdmin();

    const { offerId } = await params;
    const body = await req.json();
    const { action, counterAmount, adminNotes } = body;

    if (!action || !['accept', 'reject', 'counter'].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    if (action === 'counter' && !counterAmount) {
      return NextResponse.json({ error: "Counter amount required" }, { status: 400 });
    }

    // Get the current offer
    const offerResult = await sql`
      SELECT * FROM load_offers WHERE id = ${offerId}
    `;

    if (offerResult.length === 0) {
      return NextResponse.json({ error: "Offer not found" }, { status: 404 });
    }

    const offer = offerResult[0];

    if (offer.status !== 'pending') {
      return NextResponse.json({ error: "Offer is not pending" }, { status: 400 });
    }

    let status;
    let updateResult;

    switch (action) {
      case 'accept':
        status = 'accepted';
        updateResult = await sql`
          UPDATE load_offers 
          SET status = ${status}, admin_notes = ${adminNotes || null}, driver_info_required = true, updated_at = NOW()
          WHERE id = ${offerId}
          RETURNING *
        `;
        
        // Create notification for carrier
        await sql`
          INSERT INTO carrier_notifications (
            carrier_user_id, type, title, message, priority, load_id, action_url
          ) VALUES (
            ${updateResult[0].carrier_user_id},
            'offer_accepted',
            'Offer Accepted!',
            'Your offer for load ${updateResult[0].load_rr_number} has been accepted.',
            'high',
            ${updateResult[0].id}::uuid,
            '/carrier/my-loads'
          )
        `;
        
        // Create history record
        await sql`
          INSERT INTO offer_history (
            offer_id, action, old_status, new_status, old_amount, new_amount, 
            admin_notes, performed_by, performed_at
          ) VALUES (
            ${offerId}, 'accepted', 'pending', 'accepted', 
            ${updateResult[0].offer_amount}, ${updateResult[0].offer_amount},
            ${adminNotes || null}, ${updateResult[0].carrier_user_id}, NOW()
          )
        `;
        break;
      
      case 'reject':
        status = 'rejected';
        updateResult = await sql`
          UPDATE load_offers 
          SET status = ${status}, admin_notes = ${adminNotes || null}, updated_at = NOW()
          WHERE id = ${offerId}
          RETURNING *
        `;
        
        // Create notification for carrier
        await sql`
          INSERT INTO carrier_notifications (
            carrier_user_id, type, title, message, priority, load_id, action_url
          ) VALUES (
            ${updateResult[0].carrier_user_id},
            'offer_rejected',
            'Offer Rejected',
            'Your offer for load ${updateResult[0].load_rr_number} has been rejected.',
            'medium',
            ${updateResult[0].id}::uuid,
            '/carrier/my-loads'
          )
        `;
        
        // Create history record
        await sql`
          INSERT INTO offer_history (
            offer_id, action, old_status, new_status, old_amount, new_amount, 
            admin_notes, performed_by, performed_at
          ) VALUES (
            ${offerId}, 'rejected', 'pending', 'rejected', 
            ${updateResult[0].offer_amount}, ${updateResult[0].offer_amount},
            ${adminNotes || null}, ${updateResult[0].carrier_user_id}, NOW()
          )
        `;
        break;
      
      case 'counter':
        status = 'countered';
        updateResult = await sql`
          UPDATE load_offers 
          SET status = ${status}, counter_amount = ${counterAmount}, admin_notes = ${adminNotes || null}, updated_at = NOW()
          WHERE id = ${offerId}
          RETURNING *
        `;
        
        // Create notification for carrier
        await sql`
          INSERT INTO carrier_notifications (
            carrier_user_id, type, title, message, priority, load_id, action_url
          ) VALUES (
            ${updateResult[0].carrier_user_id},
            'offer_countered',
            'Counter Offer Received',
            'You have received a counter offer of $${(counterAmount / 100).toFixed(2)} for load ${updateResult[0].load_rr_number}.',
            'high',
            ${updateResult[0].id}::uuid,
            '/carrier/my-loads'
          )
        `;
        
        // Create history record
        await sql`
          INSERT INTO offer_history (
            offer_id, action, old_status, new_status, old_amount, new_amount, 
            admin_notes, performed_by, performed_at
          ) VALUES (
            ${offerId}, 'countered', 'pending', 'countered', 
            ${updateResult[0].offer_amount}, ${counterAmount},
            ${adminNotes || null}, ${updateResult[0].carrier_user_id}, NOW()
          )
        `;
        break;
      
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    return NextResponse.json({ 
      ok: true,
      message: `Offer ${action}ed successfully`,
      offer: updateResult[0]
    });

  } catch (error) {
    console.error("Error managing offer:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}