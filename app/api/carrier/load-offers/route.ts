import sql from "@/lib/db";
import { requireApiCarrier } from "@/lib/auth-api-helper";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiCarrier(request);
    const userId = auth.userId;

    // Get offers with load details
    const offers = await sql`
      SELECT 
        lo.id,
        lo.load_rr_number,
        lo.offer_amount,
        lo.status,
        lo.created_at,
        lo.updated_at,
        lo.notes,
        lo.counter_amount,
        lo.admin_notes,
        l.rr_number,
        l.origin_city,
        l.origin_state,
        l.destination_city,
        l.destination_state,
        l.equipment,
        l.revenue,
        l.total_miles,
        l.pickup_date,
        l.pickup_time,
        l.delivery_date,
        l.delivery_time,
        l.customer_name,
        l.tm_number
      FROM load_offers lo
      JOIN loads l ON lo.load_rr_number = l.rr_number
      WHERE lo.supabase_user_id = ${userId}
      ORDER BY lo.created_at DESC
    `;

    // Transform the data to match expected structure
    const transformedOffers = offers.map(offer => ({
      id: offer.id,
      load_rr_number: offer.load_rr_number,
      offer_amount: offer.offer_amount,
      status: offer.status,
      created_at: offer.created_at,
      updated_at: offer.updated_at,
      notes: offer.notes,
      counter_amount: offer.counter_amount,
      admin_notes: offer.admin_notes,
      load: {
        rr_number: offer.rr_number,
        origin_city: offer.origin_city,
        origin_state: offer.origin_state,
        destination_city: offer.destination_city,
        destination_state: offer.destination_state,
        equipment: offer.equipment,
        revenue: offer.revenue,
        total_miles: offer.total_miles,
        pickup_date: offer.pickup_date,
        pickup_time: offer.pickup_time,
        delivery_date: offer.delivery_date,
        delivery_time: offer.delivery_time,
        customer_name: offer.customer_name,
        tm_number: offer.tm_number
      }
    }));

    return NextResponse.json({
      ok: true,
      data: transformedOffers
    });

  } catch (error) {
    console.error("Error fetching carrier load offers:", error);
    return NextResponse.json(
      { error: "Failed to fetch load offers", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
