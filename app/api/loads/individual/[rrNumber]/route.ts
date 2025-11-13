import sql from "@/lib/db.server";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ rrNumber: string }> }
) {
  try {
    const { rrNumber } = await params;
    const body = await request.json();
    const { status } = body;

    if (!status) {
      return NextResponse.json(
        { error: "Status is required" },
        { status: 400 }
      );
    }

    // Validate status
    const validStatuses = ["active", "published", "completed", "cancelled", "archived"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: "Invalid status. Must be one of: " + validStatuses.join(", ") },
        { status: 400 }
      );
    }

    // Update the load status
    const result = await sql`
      UPDATE loads 
      SET 
        status_code = ${status},
        updated_at = CURRENT_TIMESTAMP
      WHERE rr_number = ${rrNumber}
    `;

    if ((result as any).changes === 0) {
      return NextResponse.json(
        { error: "Load not found" },
        { status: 404 }
      );
    }

    // Get the updated load
    const updatedLoadResult = await sql`
      SELECT rr_number, status_code, updated_at
      FROM loads
      WHERE rr_number = ${rrNumber}
    `;
    const updatedLoad = Array.isArray(updatedLoadResult) ? updatedLoadResult[0] : null;

    return NextResponse.json({
      success: true,
      load: updatedLoad
    });

  } catch (error) {
    console.error("Error updating load:", error);
    return NextResponse.json(
      { error: "Failed to update load", details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ rrNumber: string }> }
) {
  try {
    const { rrNumber } = await params;

    const result = await sql`
      SELECT 
        rr_number,
        tm_number,
        status_code,
        pickup_date,
        pickup_time as pickup_window,
        delivery_date,
        delivery_time as delivery_window,
        revenue,
        purchase,
        net,
        margin,
        equipment,
        customer_name,
        driver_name,
        miles as total_miles,
        origin_city,
        origin_state,
        destination_city,
        destination_state,
        vendor_name,
        dispatcher_name,
        updated_at,
        published
      FROM loads
      WHERE rr_number = ${rrNumber}
    `;

    if (!Array.isArray(result) || result.length === 0) {
      return NextResponse.json(
        { error: "Load not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      load: result[0]
    });

  } catch (error) {
    console.error("Error fetching load:", error);
    return NextResponse.json(
      { error: "Failed to fetch load", details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
