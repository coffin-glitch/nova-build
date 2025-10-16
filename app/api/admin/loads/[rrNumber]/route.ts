import { getClerkUserRole } from "@/lib/clerk-server";
import sql from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ rrNumber: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const userRole = await getClerkUserRole(userId);
    if (userRole !== "admin") {
      return NextResponse.json({ error: "Only admins can edit load information" }, { status: 403 });
    }

    const { rrNumber } = await params;
    const body = await req.json();
    
    const {
      // Basic load information
      tm_number,
      status_code,
      pickup_date,
      pickup_time,
      delivery_date,
      delivery_time,
      equipment,
      weight,
      stops,
      total_miles,
      customer_name,
      customer_ref,
      driver_name,
      vendor_name,
      dispatcher_name,
      
      // Financial information
      revenue,
      target_buy,
      max_buy,
      purchase,
      net,
      margin,
      spot_bid,
      fuel_surcharge,
      purch_tr,
      net_mrg,
      cm,
      
      // Additional EAX fields
      docs_scanned,
      invoice_date,
      invoice_audit,
      nbr_of_stops,
      vendor_dispatch,
      
      // Status
      published
    } = body;

    // Check if load exists
    const existingLoad = await sql`
      SELECT rr_number FROM loads WHERE rr_number = ${rrNumber}
    `;

    if (existingLoad.length === 0) {
      return NextResponse.json({ error: "Load not found" }, { status: 404 });
    }

    // Update the load with all provided fields
    const updateResult = await sql`
      UPDATE loads SET
        tm_number = ${tm_number || null},
        status_code = ${status_code || null},
        pickup_date = ${pickup_date ? new Date(pickup_date) : null},
        pickup_time = ${pickup_time || null},
        delivery_date = ${delivery_date ? new Date(delivery_date) : null},
        delivery_time = ${delivery_time || null},
        equipment = ${equipment || null},
        weight = ${weight || null},
        stops = ${stops || null},
        total_miles = ${total_miles || null},
        customer_name = ${customer_name || null},
        customer_ref = ${customer_ref || null},
        driver_name = ${driver_name || null},
        vendor_name = ${vendor_name || null},
        dispatcher_name = ${dispatcher_name || null},
        revenue = ${revenue || null},
        target_buy = ${target_buy || null},
        max_buy = ${max_buy || null},
        purchase = ${purchase || null},
        net = ${net || null},
        margin = ${margin || null},
        spot_bid = ${spot_bid || null},
        fuel_surcharge = ${fuel_surcharge || null},
        purch_tr = ${purch_tr || null},
        net_mrg = ${net_mrg || null},
        cm = ${cm || null},
        docs_scanned = ${docs_scanned || null},
        invoice_date = ${invoice_date ? new Date(invoice_date) : null},
        invoice_audit = ${invoice_audit || null},
        nbr_of_stops = ${nbr_of_stops || null},
        vendor_dispatch = ${vendor_dispatch || null},
        published = ${published !== undefined ? published : null},
        updated_at = NOW()
      WHERE rr_number = ${rrNumber}
      RETURNING *
    `;

    if (updateResult.length === 0) {
      return NextResponse.json({ error: "Failed to update load" }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      message: "Load updated successfully",
      load: updateResult[0]
    });

  } catch (error) {
    console.error("Error updating load:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ rrNumber: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const userRole = await getClerkUserRole(userId);
    const { rrNumber } = await params;

    // Get load details - admins see all fields, carriers see limited fields
    let loadResult;
    if (userRole === "admin") {
      loadResult = await sql`
        SELECT * FROM loads WHERE rr_number = ${rrNumber}
      `;
    } else if (userRole === "carrier") {
      // Carriers can only see published loads with limited fields
      loadResult = await sql`
        SELECT 
          rr_number, tm_number, pickup_date, pickup_time, delivery_date, delivery_time,
          equipment, weight, stops, total_miles, customer_name, origin_city, origin_state,
          destination_city, destination_state, target_buy, published, created_at, updated_at
        FROM loads 
        WHERE rr_number = ${rrNumber} AND published = true
      `;
    } else {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    if (loadResult.length === 0) {
      return NextResponse.json({ error: "Load not found" }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true,
      load: loadResult[0]
    });

  } catch (error) {
    console.error("Error fetching load:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
