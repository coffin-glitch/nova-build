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

export async function GET(
  request: NextRequest
) {
  try {
    const auth = await requireApiCarrier(request);
    const userId = auth.userId;

    const { searchParams } = new URL(request.url);
    const bidNumber = searchParams.get('bidNumber');
    
    if (!bidNumber) {
      return NextResponse.json(
        { error: "bidNumber parameter is required" },
        { status: 400 }
      );
    }

    // Verify the user owns this bid
    const bidOwnership = await sql`
      SELECT 1 FROM auction_awards 
      WHERE bid_number = ${bidNumber} 
        AND supabase_winner_user_id = ${userId}
      LIMIT 1
    `;

    if (bidOwnership.length === 0) {
      return NextResponse.json(
        { error: "Bid not found or not authorized" },
        { status: 404 }
      );
    }

    // Get driver information from carrier_bids
    const driverInfo = await sql`
      SELECT 
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
        driver_info_submitted_at
      FROM carrier_bids
      WHERE bid_number = ${bidNumber} AND supabase_user_id = ${userId}
      LIMIT 1
    `;

    if (driverInfo.length === 0) {
      return NextResponse.json({
        ok: true,
        data: null
      });
    }

    logSecurityEvent('bid_driver_info_accessed', userId, { bidNumber });
    
    const response = NextResponse.json({
      ok: true,
      data: driverInfo[0]
    });
    
    return addSecurityHeaders(response);

  } catch (error: any) {
    console.error("Error fetching driver information:", error);
    
    if (error.message === "Unauthorized" || error.message === "Carrier access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('bid_driver_info_fetch_error', undefined, { 
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

export async function POST(
  request: NextRequest
) {
  try {
    const auth = await requireApiCarrier(request);
    const userId = auth.userId;

    const { searchParams } = new URL(request.url);
    const bidNumber = searchParams.get('bidNumber');
    
    if (!bidNumber) {
      return NextResponse.json(
        { error: "bidNumber parameter is required" },
        { status: 400 }
      );
    }
    const { 
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
      location,
      notes
    } = await request.json();

    // Additional input validation for driver info
    const driverValidation = validateInput(
      { driver_name, driver_phone, driver_email, driver_license_number, driver_license_state, truck_number, trailer_number, second_driver_name, second_driver_phone, second_driver_email, second_driver_license_number, second_driver_license_state, second_truck_number, second_trailer_number, location, notes },
      {
        driver_name: { required: true, type: 'string', minLength: 1, maxLength: 100 },
        driver_phone: { required: true, type: 'string', pattern: /^[\d\s\-\(\)]+$/, maxLength: 20 },
        driver_email: { type: 'string', pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, maxLength: 255, required: false },
        driver_license_number: { type: 'string', maxLength: 50, required: false },
        driver_license_state: { type: 'string', pattern: /^[A-Z]{2}$/, maxLength: 2, required: false },
        truck_number: { type: 'string', maxLength: 50, required: false },
        trailer_number: { type: 'string', maxLength: 50, required: false },
        second_driver_name: { type: 'string', maxLength: 100, required: false },
        second_driver_phone: { type: 'string', pattern: /^[\d\s\-\(\)]+$/, maxLength: 20, required: false },
        second_driver_email: { type: 'string', pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, maxLength: 255, required: false },
        second_driver_license_number: { type: 'string', maxLength: 50, required: false },
        second_driver_license_state: { type: 'string', pattern: /^[A-Z]{2}$/, maxLength: 2, required: false },
        second_truck_number: { type: 'string', maxLength: 50, required: false },
        second_trailer_number: { type: 'string', maxLength: 50, required: false },
        location: { type: 'string', maxLength: 200, required: false },
        notes: { type: 'string', maxLength: 1000, required: false }
      }
    );

    if (!driverValidation.valid) {
      logSecurityEvent('invalid_bid_driver_info_fields', userId, { errors: driverValidation.errors });
      const response = NextResponse.json(
        { error: `Invalid driver info: ${driverValidation.errors.join(', ')}` },
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

    // Format secondary phone if provided
    let formattedSecondPhone = null;
    if (second_driver_phone) {
      formattedSecondPhone = formatPhoneNumber(second_driver_phone);
      if (!formattedSecondPhone) {
        const response = NextResponse.json(
          { error: "Secondary driver phone number must be exactly 10 digits" },
          { status: 400 }
        );
        return addSecurityHeaders(response);
      }
    }

    // Verify the user owns this bid
    // Note: winner_user_id was removed in migration 078, only supabase_winner_user_id exists
    const bidOwnership = await sql`
      SELECT 1 FROM auction_awards 
      WHERE bid_number = ${bidNumber} 
        AND supabase_winner_user_id = ${userId}
      LIMIT 1
    `;

    if (bidOwnership.length === 0) {
      return NextResponse.json(
        { error: "Bid not found or not authorized" },
        { status: 404 }
      );
    }

    // Update the carrier_bids table with driver information
    // First check if a carrier_bids record exists
    const existingBid = await sql`
      SELECT id FROM carrier_bids
      WHERE bid_number = ${bidNumber} AND supabase_user_id = ${userId}
      LIMIT 1
    `;

    if (existingBid.length > 0) {
      // Update existing record
      await sql`
        UPDATE carrier_bids SET
          driver_name = ${driver_name.trim()},
          driver_phone = ${formattedPhone},
          driver_email = ${driver_email?.trim() || null},
          driver_license_number = ${driver_license_number?.trim() || null},
          driver_license_state = ${driver_license_state?.trim() || null},
          truck_number = ${truck_number?.trim() || null},
          trailer_number = ${trailer_number?.trim() || null},
          second_driver_name = ${second_driver_name?.trim() || null},
          second_driver_phone = ${formattedSecondPhone},
          second_driver_email = ${second_driver_email?.trim() || null},
          second_driver_license_number = ${second_driver_license_number?.trim() || null},
          second_driver_license_state = ${second_driver_license_state?.trim() || null},
          second_truck_number = ${second_truck_number?.trim() || null},
          second_trailer_number = ${second_trailer_number?.trim() || null},
          driver_info_submitted_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE bid_number = ${bidNumber} AND supabase_user_id = ${userId}
      `;
    } else {
      // Create new record with driver info
      // Get the bid amount from the auction award
      const awardInfo = await sql`
        SELECT winner_amount_cents 
        FROM auction_awards 
        WHERE bid_number = ${bidNumber} AND supabase_winner_user_id = ${userId}
        LIMIT 1
      `;

      await sql`
        INSERT INTO carrier_bids (
          bid_number,
          supabase_user_id,
          amount_cents,
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
          driver_info_submitted_at,
          status,
          created_at,
          updated_at
        ) VALUES (
          ${bidNumber},
          ${userId},
          ${awardInfo[0]?.winner_amount_cents || 0},
          ${driver_name.trim()},
          ${formattedPhone},
          ${driver_email?.trim() || null},
          ${driver_license_number?.trim() || null},
          ${driver_license_state?.trim() || null},
          ${truck_number?.trim() || null},
          ${trailer_number?.trim() || null},
          ${second_driver_name?.trim() || null},
          ${formattedSecondPhone},
          ${second_driver_email?.trim() || null},
          ${second_driver_license_number?.trim() || null},
          ${second_driver_license_state?.trim() || null},
          ${second_truck_number?.trim() || null},
          ${second_trailer_number?.trim() || null},
          CURRENT_TIMESTAMP,
          'bid_awarded',
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
      `;
    }

    logSecurityEvent('bid_driver_info_updated', userId, { bidNumber });
    
    const response = NextResponse.json({
      ok: true,
      message: "Driver information updated successfully"
    });
    
    return addSecurityHeaders(response);

  } catch (error: any) {
    console.error("Error updating driver information:", error);
    
    if (error.message === "Unauthorized" || error.message === "Carrier access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('bid_driver_info_update_error', undefined, { 
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

