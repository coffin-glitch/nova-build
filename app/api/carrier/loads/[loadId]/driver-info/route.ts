import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { requireApiCarrier, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// Format phone number to 10 digits only
function formatPhoneNumber(phone: string): string | null {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return cleaned;
  }
  return null;
}

// GET - Fetch driver information for a specific load
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ loadId: string }> }
) {
  try {
    // Ensure user is carrier (Supabase-only)
    const authResult = await requireApiCarrier(request);
    const userId = authResult.userId;

    // Check rate limit for authenticated read operation
    const rateLimit = await checkApiRateLimit(request, {
      userId,
      routeType: 'readOnly'
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
      return addRateLimitHeaders(addSecurityHeaders(response), rateLimit);
    }

    const { loadId } = await params;

    // Input validation
    const validation = validateInput(
      { loadId },
      {
        loadId: { required: true, type: 'string', maxLength: 100 }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_load_driver_info_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // Handle both integer loadId and UUID loadOfferId
    let loadOfferId = loadId;
    if (/^\d+$/.test(loadId)) {
      // If loadId is an integer, find the corresponding load_offer_id
      const loadOfferResult = await sql`
        SELECT lo.id as load_offer_id
        FROM loads l
        INNER JOIN load_offers lo ON l.rr_number = lo.load_rr_number
        WHERE l.id = ${parseInt(loadId)}
          AND lo.supabase_user_id = ${userId}
          AND lo.status = 'accepted'
        LIMIT 1
      `;
      
      if (loadOfferResult.length === 0) {
        return NextResponse.json({ error: "Load not found or not accessible" }, { status: 404 });
      }
      
      loadOfferId = loadOfferResult[0].load_offer_id;
    }

    // Get driver information from load_offers table
    const driverInfo = await sql`
      SELECT 
        driver_name,
        driver_phone,
        driver_email,
        driver_license_number,
        driver_license_state,
        truck_number,
        trailer_number
      FROM load_offers 
      WHERE id = ${loadOfferId} AND supabase_user_id = ${userId}
    `;

    if (driverInfo.length === 0) {
      logSecurityEvent('load_driver_info_not_found', userId, { loadId });
      const response = NextResponse.json(
        { error: "Load offer not found" },
        { status: 404 }
      );
      return addSecurityHeaders(response);
    }

    logSecurityEvent('load_driver_info_accessed', userId, { loadId });
    
    const response = NextResponse.json({
      ok: true,
      driver_info: driverInfo[0]
    });
    
    return addRateLimitHeaders(addSecurityHeaders(response), rateLimit);

  } catch (error: any) {
    console.error("Error fetching driver information:", error);
    
    if (error.message === "Unauthorized" || error.message === "Carrier access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('load_driver_info_fetch_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to fetch driver information",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}

// POST - Update driver information for a specific load
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ loadId: string }> }
) {
  try {
    // Ensure user is carrier (Supabase-only)
    const authResult = await requireApiCarrier(request);
    const userId = authResult.userId;

    const { loadId } = await params;
    const { 
      driver_name,
      driver_phone,
      driver_email,
      driver_license_number,
      driver_license_state,
      truck_number,
      trailer_number,
      notes,
      location
    } = await request.json();

    // Input validation
    const validation = validateInput(
      { loadId, driver_name, driver_phone, driver_email, driver_license_number, driver_license_state, truck_number, trailer_number, notes, location },
      {
        loadId: { required: true, type: 'string', maxLength: 100 },
        driver_name: { required: true, type: 'string', minLength: 1, maxLength: 100 },
        driver_phone: { required: true, type: 'string', pattern: /^[\d\s\-\(\)]+$/, maxLength: 20 },
        driver_email: { type: 'string', pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, maxLength: 255, required: false },
        driver_license_number: { type: 'string', maxLength: 50, required: false },
        driver_license_state: { type: 'string', pattern: /^[A-Z]{2}$/, maxLength: 2, required: false },
        truck_number: { type: 'string', maxLength: 50, required: false },
        trailer_number: { type: 'string', maxLength: 50, required: false },
        notes: { type: 'string', maxLength: 1000, required: false },
        location: { type: 'string', maxLength: 200, required: false }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_load_driver_info_update_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // Validate required fields
    if (!driver_name?.trim()) {
      const response = NextResponse.json(
        { error: "Driver name is required" },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    if (!driver_phone?.trim()) {
      const response = NextResponse.json(
        { error: "Driver phone number is required" },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // Format and validate phone number
    const formattedPhone = formatPhoneNumber(driver_phone);
    if (!formattedPhone) {
      const response = NextResponse.json(
        { error: "Driver phone number must be exactly 10 digits" },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // Handle both integer loadId and UUID loadOfferId
    let loadOfferId = loadId;
    if (/^\d+$/.test(loadId)) {
      // If loadId is an integer, find the corresponding load_offer_id
      const loadOfferResult = await sql`
        SELECT lo.id as load_offer_id, lo.status
        FROM loads l
        INNER JOIN load_offers lo ON l.rr_number = lo.load_rr_number
        WHERE l.id = ${parseInt(loadId)}
          AND lo.supabase_user_id = ${userId}
          AND lo.status = 'accepted'
        LIMIT 1
      `;
      
      if (loadOfferResult.length === 0) {
        return NextResponse.json({ error: "Load not found or not accessible" }, { status: 404 });
      }
      
      loadOfferId = loadOfferResult[0].load_offer_id;
    }

    // Get current status for the load offer
    const loadOffer = await sql`
      SELECT status FROM load_offers 
      WHERE id = ${loadOfferId} AND supabase_user_id = ${userId}
    `;

    if (loadOffer.length === 0) {
      logSecurityEvent('load_offer_not_found_for_driver_info', userId, { loadId });
      const response = NextResponse.json(
        { error: "Load offer not found" },
        { status: 404 }
      );
      return addSecurityHeaders(response);
    }

    const currentStatus = loadOffer[0].status;

    // Update the load offer with driver information
    await sql`
      UPDATE load_offers 
      SET 
        driver_name = ${driver_name.trim()},
        driver_phone = ${formattedPhone},
        driver_email = ${driver_email?.trim() || null},
        driver_license_number = ${driver_license_number?.trim() || null},
        driver_license_state = ${driver_license_state?.trim() || null},
        truck_number = ${truck_number?.trim() || null},
        trailer_number = ${trailer_number?.trim() || null},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${loadOfferId} AND supabase_user_id = ${userId}
    `;

    // Create driver info update event in lifecycle
    const eventResult = await sql`
      INSERT INTO load_lifecycle_events (
        load_offer_id,
        status,
        timestamp,
        notes,
        location,
        event_type,
        driver_name,
        driver_phone,
        driver_email,
        driver_license_number,
        driver_license_state,
        truck_number,
        trailer_number,
        created_at
      ) VALUES (
        ${loadOfferId},
        ${currentStatus},
        CURRENT_TIMESTAMP,
        ${notes || 'Driver information updated'},
        ${location || null},
        'driver_info_update',
        ${driver_name.trim()},
        ${formattedPhone},
        ${driver_email?.trim() || null},
        ${driver_license_number?.trim() || null},
        ${driver_license_state?.trim() || null},
        ${truck_number?.trim() || null},
        ${trailer_number?.trim() || null},
        CURRENT_TIMESTAMP
      ) RETURNING id, timestamp
    `;

    logSecurityEvent('load_driver_info_updated', userId, { loadId, eventId: eventResult[0].id });
    
    const response = NextResponse.json({
      ok: true,
      data: {
        eventId: eventResult[0].id,
        timestamp: eventResult[0].timestamp,
        message: "Driver information updated successfully"
      }
    });
    
    return addRateLimitHeaders(addSecurityHeaders(response), rateLimit);

  } catch (error: any) {
    console.error("Error updating driver information:", error);
    
    if (error.message === "Unauthorized" || error.message === "Carrier access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('load_driver_info_update_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to update driver information",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}
