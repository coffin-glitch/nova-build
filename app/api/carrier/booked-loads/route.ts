import sql from "@/lib/db";
import { requireApiCarrier } from "@/lib/auth-api-helper";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiCarrier(request);
    const userId = auth.userId;
    
    console.log("Booked loads - userId:", userId);
    
    // Simplified query first
    const bookedLoads = await sql`
      SELECT 
        lo.id as id,
        l.rr_number,
        l.origin_city,
        l.origin_state,
        l.destination_city,
        l.destination_state,
        lo.offer_amount as revenue,
        l.total_miles as miles,
        l.equipment,
        l.customer_name,
        lo.status,
        lo.created_at as assigned_at
      FROM loads l
      INNER JOIN load_offers lo ON l.rr_number = lo.load_rr_number
      WHERE lo.supabase_user_id = ${userId}
        AND lo.status IN ('accepted', 'assigned', 'checked_in', 'picked_up', 'departed', 'in_transit', 'checked_in_delivery', 'delivered', 'completed')
      ORDER BY lo.created_at DESC
    `;

    console.log("Booked loads - result:", bookedLoads);

    return NextResponse.json({
      ok: true,
      data: bookedLoads
    });

  } catch (error) {
    console.error("Error fetching carrier booked loads:", error);
    return NextResponse.json(
      { error: "Failed to fetch booked loads", details: error.message },
      { status: 500 }
    );
  }
}
