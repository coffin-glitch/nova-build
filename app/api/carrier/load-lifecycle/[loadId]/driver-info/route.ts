import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ loadId: string }> }
) {
  try {
    const auth = await requireApiCarrier(request);
    const userId = auth.userId;

    const { loadId } = await params;
    const { 
      driver_info,
      notes,
      location
    } = await request.json();

    // Input validation
    const validation = validateInput(
      { loadId, notes, location },
      {
        loadId: { required: true, type: 'string', maxLength: 100 },
        notes: { type: 'string', maxLength: 1000, required: false },
        location: { type: 'string', maxLength: 200, required: false }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_load_lifecycle_driver_info_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // Validate required driver information
    if (!driver_info?.driver_name || !driver_info?.driver_phone) {
      const response = NextResponse.json(
        { error: "Driver name and phone number are required" },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // Format and validate phone numbers
    const formattedPhone = formatPhoneNumber(driver_info.driver_phone);
    if (!formattedPhone) {
      const response = NextResponse.json(
        { error: "Driver phone number must be exactly 10 digits" },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    let formattedSecondPhone = null;
    if (driver_info.second_driver_phone) {
      formattedSecondPhone = formatPhoneNumber(driver_info.second_driver_phone);
      if (!formattedSecondPhone) {
        return NextResponse.json({ 
          error: "Secondary driver phone number must be exactly 10 digits" 
        }, { status: 400 });
      }
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
        logSecurityEvent('load_lifecycle_driver_info_unauthorized', userId, { loadId });
        const response = NextResponse.json(
          { error: "Load not found or not accessible" },
          { status: 404 }
        );
        return addSecurityHeaders(response);
      }
      
      loadOfferId = loadOfferResult[0].load_offer_id;
    } else {
      // If loadId is a UUID, get the load offer directly
      const loadOffer = await sql`
        SELECT id, status FROM load_offers 
        WHERE id = ${loadId} AND supabase_user_id = ${userId}
      `;

      if (loadOffer.length === 0) {
        logSecurityEvent('load_offer_not_found_lifecycle', userId, { loadId });
        const response = NextResponse.json(
          { error: "Load not found" },
          { status: 404 }
        );
        return addSecurityHeaders(response);
      }

      loadOfferId = loadId;
    }

    // Get current status for the load offer
    const loadOffer = await sql`
      SELECT status FROM load_offers 
      WHERE id = ${loadOfferId} AND supabase_user_id = ${userId}
    `;

    if (loadOffer.length === 0) {
      logSecurityEvent('load_offer_not_found_lifecycle_driver', userId, { loadId });
      const response = NextResponse.json(
        { error: "Load offer not found" },
        { status: 404 }
      );
      return addSecurityHeaders(response);
    }

    const currentStatus = loadOffer[0].status;

    // Create driver info update event
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
        second_driver_name,
        second_driver_phone,
        second_driver_email,
        second_driver_license_number,
        second_driver_license_state,
        second_truck_number,
        second_trailer_number,
        created_at
      ) VALUES (
        ${loadOfferId},
        ${currentStatus},
        CURRENT_TIMESTAMP,
        ${notes || 'Driver information updated'},
        ${location || null},
        'driver_info_update',
        ${driver_info.driver_name},
        ${formattedPhone},
        ${driver_info.driver_email || null},
        ${driver_info.driver_license_number || null},
        ${driver_info.driver_license_state || null},
        ${driver_info.truck_number || null},
        ${driver_info.trailer_number || null},
        ${driver_info.second_driver_name || null},
        ${formattedSecondPhone},
        ${driver_info.second_driver_email || null},
        ${driver_info.second_driver_license_number || null},
        ${driver_info.second_driver_license_state || null},
        ${driver_info.second_truck_number || null},
        ${driver_info.second_trailer_number || null},
        CURRENT_TIMESTAMP
      ) RETURNING id, timestamp
    `;

    // Update the load offer with the latest driver information
    await sql`
      UPDATE load_offers 
      SET 
        driver_name = ${driver_info.driver_name},
        driver_phone = ${formattedPhone},
        driver_email = ${driver_info.driver_email || null},
        driver_license_number = ${driver_info.driver_license_number || null},
        driver_license_state = ${driver_info.driver_license_state || null},
        truck_number = ${driver_info.truck_number || null},
        trailer_number = ${driver_info.trailer_number || null},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${loadOfferId} AND supabase_user_id = ${userId}
    `;

    logSecurityEvent('load_lifecycle_driver_info_updated', userId, { 
      loadId, 
      eventId: eventResult[0].id 
    });
    
    const response = NextResponse.json({
      ok: true,
      data: {
        eventId: eventResult[0].id,
        timestamp: eventResult[0].timestamp,
        message: "Driver information updated successfully"
      }
    });
    
    return addSecurityHeaders(response);

  } catch (error: any) {
    console.error("Error updating driver information:", error);
    
    if (error.message === "Unauthorized" || error.message === "Carrier access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('load_lifecycle_driver_info_update_error', undefined, { 
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

