import { isClerkAdmin } from "@/lib/clerk-server";
import { db } from "@/lib/db-local";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const isAdmin = await isClerkAdmin(userId);
    if (!isAdmin) {
      return NextResponse.json({ error: "Only admins can manage offers" }, { status: 403 });
    }

    const body = await req.json();
    const { action, counterAmount, adminNotes } = body;

    if (!action || !['accept', 'reject', 'counter'].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    if (action === 'counter' && !counterAmount) {
      return NextResponse.json({ error: "Counter amount required" }, { status: 400 });
    }

    // Get the current offer
    const offer = db.prepare(`
      SELECT * FROM load_offers WHERE id = ?
    `).get(params.id);

    if (!offer) {
      return NextResponse.json({ error: "Offer not found" }, { status: 404 });
    }

    if (offer.status !== 'pending') {
      return NextResponse.json({ error: "Offer is not pending" }, { status: 400 });
    }

    let status;
    let updateQuery;

    switch (action) {
      case 'accept':
        status = 'accepted';
        updateQuery = db.prepare(`
          UPDATE load_offers 
          SET status = ?, admin_notes = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `);
        updateQuery.run(status, adminNotes || '', params.id);
        break;
      
      case 'reject':
        status = 'rejected';
        updateQuery = db.prepare(`
          UPDATE load_offers 
          SET status = ?, admin_notes = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `);
        updateQuery.run(status, adminNotes || '', params.id);
        break;
      
      case 'counter':
        status = 'countered';
        updateQuery = db.prepare(`
          UPDATE load_offers 
          SET status = ?, counter_amount = ?, admin_notes = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `);
        updateQuery.run(status, counterAmount, adminNotes || '', params.id);
        break;
      
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true, 
      message: `Offer ${action}ed successfully`,
      status 
    });

  } catch (error) {
    console.error("Error managing offer:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}