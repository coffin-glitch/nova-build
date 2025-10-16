import { roleManager } from "@/lib/role-manager";
import sql from "@/lib/db";
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
      return NextResponse.json({ error: "Only admins can update loads" }, { status: 403 });
    }

    const body = await req.json();
    const { 
      rrNumber, 
      originCity, 
      originState, 
      destinationCity, 
      destinationState,
      pickupDate,
      deliveryDate,
      equipment,
      revenue,
      purchase,
      net,
      margin,
      customerName,
      customerRef,
      driverName,
      vendorName,
      dispatcherName,
      statusCode,
      tmNumber
    } = body;

    if (!rrNumber) {
      return NextResponse.json({ error: "RR Number is required" }, { status: 400 });
    }

    const db = sql;

    // Check if load exists
    const existingLoad = await db`
      SELECT rr_number FROM loads WHERE rr_number = ${rrNumber}
    `;

    if (!existingLoad || existingLoad.length === 0) {
      return NextResponse.json({ error: "Load not found" }, { status: 404 });
    }

    // Update the load
    const result = await db`
      UPDATE loads SET
        origin_city = ${originCity || null},
        origin_state = ${originState || null},
        destination_city = ${destinationCity || null},
        destination_state = ${destinationState || null},
        pickup_date = ${pickupDate || null},
        delivery_date = ${deliveryDate || null},
        equipment = ${equipment || null},
        revenue = ${revenue || null},
        purchase = ${purchase || null},
        net = ${net || null},
        margin = ${margin || null},
        customer_name = ${customerName || null},
        customer_ref = ${customerRef || null},
        driver_name = ${driverName || null},
        vendor_name = ${vendorName || null},
        dispatcher_name = ${dispatcherName || null},
        status_code = ${statusCode || null},
        tm_number = ${tmNumber || null},
        updated_at = NOW()
      WHERE rr_number = ${rrNumber}
      RETURNING *
    `;

    if (result.length === 0) {
      return NextResponse.json({ error: "No changes made" }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true, 
      message: "Load updated successfully",
      rrNumber 
    });

  } catch (error) {
    console.error("Error updating load:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

