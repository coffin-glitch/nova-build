import sql from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ offerId: string }> }
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const userRoleResult = await sql`
      SELECT role FROM user_roles_cache WHERE clerk_user_id = ${userId}
    `;
    
    if (userRoleResult.length === 0 || userRoleResult[0].role !== 'admin') {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { offerId } = await params;

    // Get load lifecycle events for the offer
    const events = await sql`
      SELECT 
        lle.id,
        lle.status,
        lle.timestamp,
        lle.notes,
        lle.check_in_time,
        lle.pickup_time,
        lle.departure_time,
        lle.delivery_time,
        lle.driver_name,
        lle.truck_number,
        lle.trailer_number,
        lo.status as current_status
      FROM load_lifecycle_events lle
      INNER JOIN load_offers lo ON lle.load_offer_id = lo.id
      WHERE lo.id = ${offerId}
      ORDER BY lle.timestamp ASC
    `;

    const currentStatus = events.length > 0 ? events[events.length - 1].status : 'pending';

    return NextResponse.json({
      ok: true,
      data: {
        events: events.map(event => ({
          id: event.id,
          status: event.status,
          timestamp: event.timestamp,
          notes: event.notes,
          check_in_time: event.check_in_time,
          pickup_time: event.pickup_time,
          departure_time: event.departure_time,
          delivery_time: event.delivery_time,
          driver_name: event.driver_name,
          truck_number: event.truck_number,
          trailer_number: event.trailer_number
        })),
        currentStatus
      }
    });

  } catch (error) {
    console.error("Error fetching admin load lifecycle:", error);
    return NextResponse.json(
      { error: "Failed to fetch lifecycle data" },
      { status: 500 }
    );
  }
}
