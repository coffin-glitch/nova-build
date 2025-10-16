import { requireAdmin } from "@/lib/clerk-server";
import sql from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // This will redirect if user is not admin
    await requireAdmin();

    // Get all offers with load details
    const offers = await sql`
      SELECT 
        lo.id,
        lo.load_rr_number,
        lo.carrier_user_id,
        lo.offer_amount,
        lo.status,
        lo.notes,
        lo.admin_notes,
        lo.counter_amount,
        lo.created_at,
        lo.updated_at,
        l.origin_city,
        l.origin_state,
        l.destination_city,
        l.destination_state,
        l.equipment,
        l.revenue,
        l.total_miles,
        l.pickup_date,
        l.delivery_date,
        l.customer_name
      FROM load_offers lo
      JOIN loads l ON lo.load_rr_number = l.rr_number
      ORDER BY lo.created_at DESC
    `;

    return NextResponse.json({
      ok: true,
      offers: offers
    });

  } catch (error) {
    console.error("Error fetching admin offers:", error);
    return NextResponse.json(
      { error: "Failed to fetch offers", details: error.message },
      { status: 500 }
    );
  }
}
