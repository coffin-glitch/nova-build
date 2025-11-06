import { requireApiAdmin } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bidNumber: string }> }
) {
  try {
    // Ensure user is admin (Supabase-only)
    await requireApiAdmin(request);

    const { bidNumber } = await params;

    // Get lifecycle events for this bid
    const events = await sql`
      SELECT 
        id,
        bid_id,
        event_type,
        event_data,
        timestamp,
        notes,
        documents,
        location,
        driver_name,
        driver_phone,
        driver_email,
        driver_license_number,
        driver_license_state,
        truck_number,
        trailer_number,
        second_driver_name,
        second_driver_phone,
        second_driver_email,
        second_driver_license_number,
        second_driver_license_state,
        second_truck_number,
        second_trailer_number,
        check_in_time,
        pickup_time,
        departure_time,
        check_in_delivery_time,
        delivery_time
      FROM bid_lifecycle_events
      WHERE bid_id = ${bidNumber}
      ORDER BY timestamp ASC
    `;

    return NextResponse.json(events);
  } catch (error) {
    console.error("Error fetching bid lifecycle events:", error);
    return NextResponse.json(
      { error: "Failed to fetch bid lifecycle events" },
      { status: 500 }
    );
  }
}
