import { requireAdmin } from "@/lib/clerk-server";
import sql from "@/lib/db";
import { NextResponse } from "next/server";

export async function PUT(req: Request) {
  try {
    // Ensure user is admin
    await requireAdmin();

    const body = await req.json();
    const { offerIds, action, adminNotes } = body;

    if (!offerIds || !Array.isArray(offerIds) || offerIds.length === 0) {
      return NextResponse.json({ error: "No offers selected" }, { status: 400 });
    }

    if (!action || !['accept', 'reject'].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    // Validate that all offers exist and are pending
    const offers = await sql`
      SELECT id, carrier_user_id, load_rr_number, offer_amount, status
      FROM load_offers 
      WHERE id = ANY(${offerIds}) AND status = 'pending'
    `;

    if (offers.length !== offerIds.length) {
      return NextResponse.json({ 
        error: "Some offers not found or not pending" 
      }, { status: 400 });
    }

    // Update all offers
    const updateResult = await sql`
      UPDATE load_offers 
      SET 
        status = ${action === 'accept' ? 'accepted' : 'rejected'},
        admin_notes = ${adminNotes || null},
        updated_at = NOW()
      WHERE id = ANY(${offerIds})
      RETURNING id, carrier_user_id, load_rr_number
    `;

    // Create notifications for each carrier
    for (const offer of updateResult) {
      await sql`
        INSERT INTO carrier_notifications (
          carrier_user_id,
          type,
          title,
          message,
          is_read,
          created_at
        ) VALUES (
          ${offer.carrier_user_id},
          ${action === 'accept' ? 'offer_accepted' : 'offer_rejected'},
          ${action === 'accept' ? 'Offer Accepted' : 'Offer Rejected'},
          ${action === 'accept' 
            ? `Your offer for load ${offer.load_rr_number} has been accepted!` 
            : `Your offer for load ${offer.load_rr_number} has been rejected.`},
          false,
          NOW()
        )
      `;

      // Create history record
      await sql`
        INSERT INTO offer_history (
          offer_id,
          action,
          old_status,
          new_status,
          admin_notes,
          performed_by,
          performed_at
        ) VALUES (
          ${offer.id},
          ${action},
          'pending',
          ${action === 'accept' ? 'accepted' : 'rejected'},
          ${adminNotes || null},
          'admin',
          NOW()
        )
      `;
    }

    return NextResponse.json({ 
      success: true, 
      processedCount: updateResult.length,
      message: `${updateResult.length} offers ${action}ed successfully` 
    });

  } catch (error) {
    console.error("Error processing bulk offer action:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
