import sql from "@/lib/db";
import { requireApiCarrier } from "@/lib/auth-api-helper";
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

    const { loadId } = await params;

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
      return NextResponse.json({ error: "Load offer not found" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      driver_info: driverInfo[0]
    });

  } catch (error) {
    console.error("Error fetching driver information:", error);
    return NextResponse.json(
      { error: "Failed to fetch driver information" },
      { status: 500 }
    );
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

    // Validate required fields
    if (!driver_name?.trim()) {
      return NextResponse.json({ 
        error: "Driver name is required" 
      }, { status: 400 });
    }

    if (!driver_phone?.trim()) {
      return NextResponse.json({ 
        error: "Driver phone number is required" 
      }, { status: 400 });
    }

    // Format and validate phone number
    const formattedPhone = formatPhoneNumber(driver_phone);
    if (!formattedPhone) {
      return NextResponse.json({ 
        error: "Driver phone number must be exactly 10 digits" 
      }, { status: 400 });
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
      return NextResponse.json({ error: "Load offer not found" }, { status: 404 });
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

    return NextResponse.json({
      ok: true,
      data: {
        eventId: eventResult[0].id,
        timestamp: eventResult[0].timestamp,
        message: "Driver information updated successfully"
      }
    });

  } catch (error) {
    console.error("Error updating driver information:", error);
    return NextResponse.json(
      { error: "Failed to update driver information" },
      { status: 500 }
    );
  }
}
