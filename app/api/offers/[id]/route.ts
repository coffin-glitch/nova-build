import { roleManager } from "@/lib/role-manager";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export async function PUT(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const userRole = await roleManager.getUserRole(userId);
    if (userRole !== 'admin') {
      return NextResponse.json({ error: "Only admins can manage offers" }, { status: 403 });
    }

    const body = await req.json();
    const { offerId, action, counterAmount, adminNotes } = body;

    if (!offerId || !action) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const db = sql;

    // Get the current offer
    const offer = await db`
      SELECT * FROM load_offers WHERE id = ${offerId}
    `;

    if (!offer || offer.length === 0) {
      return NextResponse.json({ error: "Offer not found" }, { status: 404 });
    }

    let updateQuery;
    let status;

    switch (action) {
      case 'accept':
        status = 'accepted';
        updateQuery = db`
          UPDATE load_offers 
          SET status = ${status}, admin_notes = ${adminNotes || ''}, updated_at = datetime('now')
          WHERE id = ${offerId}
        `;
        break;
      
      case 'reject':
        status = 'rejected';
        updateQuery = db`
          UPDATE load_offers 
          SET status = ${status}, admin_notes = ${adminNotes || ''}, updated_at = datetime('now')
          WHERE id = ${offerId}
        `;
        break;
      
      case 'counter':
        if (!counterAmount) {
          return NextResponse.json({ error: "Counter amount required" }, { status: 400 });
        }
        status = 'countered';
        updateQuery = db`
          UPDATE load_offers 
          SET status = ${status}, counter_amount = ${counterAmount}, admin_notes = ${adminNotes || ''}, updated_at = datetime('now')
          WHERE id = ${offerId}
        `;
        break;
      
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    await updateQuery;

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

