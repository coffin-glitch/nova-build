import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireApiAdmin(request);
    const adminUserId = auth.userId;

    // Check rate limit for admin write operation
    const rateLimit = await checkApiRateLimit(request, {
      userId: adminUserId,
      routeType: 'admin'
    });

    if (!rateLimit.allowed) {
      const response = NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: `Too many requests. Please try again after ${rateLimit.retryAfter} seconds.`,
          retryAfter: rateLimit.retryAfter
        },
        { status: 429 }
      );
      return addRateLimitHeaders(addSecurityHeaders(response, request), rateLimit);
    }

    const body = await request.json();
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

    // Input validation
    const validation = validateInput(
      { 
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
      },
      {
        rrNumber: { required: true, type: 'string', pattern: /^[A-Z0-9\-_]+$/, maxLength: 100 },
        originCity: { type: 'string', maxLength: 100, required: false },
        originState: { type: 'string', pattern: /^[A-Z]{2}$/, maxLength: 2, required: false },
        destinationCity: { type: 'string', maxLength: 100, required: false },
        destinationState: { type: 'string', pattern: /^[A-Z]{2}$/, maxLength: 2, required: false },
        pickupDate: { type: 'string', maxLength: 50, required: false },
        deliveryDate: { type: 'string', maxLength: 50, required: false },
        equipment: { type: 'string', maxLength: 50, required: false },
        revenue: { type: 'number', min: 0, max: 10000000, required: false },
        purchase: { type: 'number', min: 0, max: 10000000, required: false },
        net: { type: 'number', min: -10000000, max: 10000000, required: false },
        margin: { type: 'number', min: -10000000, max: 10000000, required: false },
        customerName: { type: 'string', maxLength: 200, required: false },
        customerRef: { type: 'string', maxLength: 100, required: false },
        driverName: { type: 'string', maxLength: 200, required: false },
        vendorName: { type: 'string', maxLength: 200, required: false },
        dispatcherName: { type: 'string', maxLength: 200, required: false },
        statusCode: { type: 'string', maxLength: 50, required: false },
        tmNumber: { type: 'string', maxLength: 100, required: false }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_load_update_input', adminUserId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response, request);
    }

    if (!rrNumber) {
      const response = NextResponse.json(
        { error: "RR Number is required" },
        { status: 400 }
      );
      return addSecurityHeaders(response, request);
    }

    const db = sql;

    // Check if load exists
    const existingLoad = await db`
      SELECT rr_number FROM loads WHERE rr_number = ${rrNumber}
    `;

    if (!existingLoad || existingLoad.length === 0) {
      logSecurityEvent('load_not_found_update_route', adminUserId, { rrNumber });
      const response = NextResponse.json(
        { error: "Load not found" },
        { status: 404 }
      );
      return addSecurityHeaders(response, request);
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
      logSecurityEvent('load_update_no_changes', adminUserId, { rrNumber });
      const response = NextResponse.json(
        { error: "No changes made" },
        { status: 400 }
      );
      return addSecurityHeaders(response, request);
    }

    logSecurityEvent('load_updated_via_update_route', adminUserId, { rrNumber });
    
    const response = NextResponse.json({ 
      success: true, 
      message: "Load updated successfully",
      rrNumber 
    });
    
    return addRateLimitHeaders(addSecurityHeaders(response, request), rateLimit);

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
    
    return addSecurityHeaders(response, request);
  }
}

