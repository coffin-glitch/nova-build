import sql from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: { loadId: string } }
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { loadId } = params;

    // Get current load status
    const loadStatus = await sql`
      SELECT 
        lo.status,
        lo.updated_at as lastUpdated,
        l.rr_number,
        l.origin_city,
        l.origin_state,
        l.destination_city,
        l.destination_state
      FROM load_offers lo
      INNER JOIN loads l ON lo.load_rr_number = l.rr_number
      WHERE lo.carrier_user_id = ${userId}
        AND lo.id = ${loadId}
        AND lo.status = 'accepted'
    `;

    if (loadStatus.length === 0) {
      return NextResponse.json({ error: "Load not found" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      data: loadStatus[0]
    });

  } catch (error) {
    console.error("Error fetching load status:", error);
    return NextResponse.json(
      { error: "Failed to fetch load status" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { loadId: string } }
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { loadId } = params;
    const { status: newStatus } = await request.json();

    // Validate status transition
    const validTransitions = {
      accepted: ['assigned'],
      assigned: ['picked_up'],
      picked_up: ['in_transit'],
      in_transit: ['delivered'],
      delivered: ['completed']
    };

    // Get current status
    const currentLoad = await sql`
      SELECT status FROM load_offers 
      WHERE id = ${loadId} AND carrier_user_id = ${userId}
    `;

    if (currentLoad.length === 0) {
      return NextResponse.json({ error: "Load not found" }, { status: 404 });
    }

    const currentStatus = currentLoad[0].status;
    
    if (!validTransitions[currentStatus as keyof typeof validTransitions]?.includes(newStatus)) {
      return NextResponse.json({ 
        error: `Invalid status transition from ${currentStatus} to ${newStatus}` 
      }, { status: 400 });
    }

    // Update status
    const result = await sql`
      UPDATE load_offers 
      SET 
        status = ${newStatus},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${loadId} AND carrier_user_id = ${userId}
      RETURNING status, updated_at
    `;

    if (result.length === 0) {
      return NextResponse.json({ error: "Failed to update status" }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      data: {
        status: result[0].status,
        lastUpdated: result[0].updated_at
      }
    });

  } catch (error) {
    console.error("Error updating load status:", error);
    return NextResponse.json(
      { error: "Failed to update load status" },
      { status: 500 }
    );
  }
}
