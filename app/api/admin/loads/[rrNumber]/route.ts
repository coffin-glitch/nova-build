import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { requireApiAdmin, requireApiCarrier, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ rrNumber: string }> }
) {
  try {
    const auth = await requireApiAdmin(request);
    const adminUserId = auth.userId;

    const { rrNumber } = await params;

    // Input validation for rrNumber
    const rrNumberValidation = validateInput(
      { rrNumber },
      {
        rrNumber: { required: true, type: 'string', pattern: /^[A-Z0-9\-_]+$/, maxLength: 100 }
      }
    );

    if (!rrNumberValidation.valid) {
      logSecurityEvent('invalid_load_update_rrnumber', adminUserId, { errors: rrNumberValidation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${rrNumberValidation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    const body = await request.json();
    
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
      logSecurityEvent('load_not_found_update', adminUserId, { rrNumber });
      const response = NextResponse.json(
        { error: "Load not found" },
        { status: 404 }
      );
      return addSecurityHeaders(response);
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
      logSecurityEvent('load_update_failed', adminUserId, { rrNumber });
      const response = NextResponse.json(
        { error: "Failed to update load" },
        { status: 500 }
      );
      return addSecurityHeaders(response);
    }

    logSecurityEvent('load_updated', adminUserId, { rrNumber });
    
    const response = NextResponse.json({ 
      success: true,
      message: "Load updated successfully",
      load: updateResult[0]
    });
    
    return addSecurityHeaders(response);

  } catch (error: any) {
    console.error("Error updating load:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('load_update_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json({ 
      error: "Internal server error",
      details: process.env.NODE_ENV === 'development' 
        ? (error instanceof Error ? error.message : 'Unknown error')
        : undefined
    }, { status: 500 });
    
    return addSecurityHeaders(response);
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ rrNumber: string }> }
) {
  try {
    // Try to get auth - if admin, show all; if carrier, show limited; if none, show public
    let userRole: 'admin' | 'carrier' | null = null;
    try {
      const auth = await requireApiAdmin(request);
      userRole = 'admin';
    } catch {
      // Not admin, try carrier
      try {
        await requireApiCarrier(request);
        userRole = 'carrier';
      } catch {
        // Public access
      }
    }

    const { rrNumber } = await params;

    // Input validation for rrNumber
    const rrNumberValidation = validateInput(
      { rrNumber },
      {
        rrNumber: { required: true, type: 'string', pattern: /^[A-Z0-9\-_]+$/, maxLength: 100 }
      }
    );

    if (!rrNumberValidation.valid) {
      const response = NextResponse.json(
        { error: `Invalid input: ${rrNumberValidation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

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
      // Public access - only published loads with limited fields
      loadResult = await sql`
        SELECT 
          rr_number, tm_number, pickup_date, pickup_time, delivery_date, delivery_time,
          equipment, weight, stops, total_miles, customer_name, origin_city, origin_state,
          destination_city, destination_state, target_buy, published, created_at, updated_at
        FROM loads 
        WHERE rr_number = ${rrNumber} AND published = true
      `;
    }

    if (loadResult.length === 0) {
      const response = NextResponse.json(
        { error: "Load not found" },
        { status: 404 }
      );
      return addSecurityHeaders(response);
    }

    const response = NextResponse.json({ 
      success: true,
      load: loadResult[0]
    });
    
    return addSecurityHeaders(response);

  } catch (error: any) {
    console.error("Error fetching load:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    const response = NextResponse.json({ 
      error: "Internal server error",
      details: process.env.NODE_ENV === 'development' 
        ? (error instanceof Error ? error.message : 'Unknown error')
        : undefined
    }, { status: 500 });
    
    return addSecurityHeaders(response);
  }
}
