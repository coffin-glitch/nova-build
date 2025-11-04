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

    return NextResponse.json({
      ok: true,
      data: driverInfo[0]
    });

  } catch (error) {
    console.error("Error fetching driver information:", error);
    return NextResponse.json(
      { error: "Failed to fetch driver information", details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
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

    // Format secondary phone if provided
    let formattedSecondPhone = null;
    if (second_driver_phone) {
      formattedSecondPhone = formatPhoneNumber(second_driver_phone);
      if (!formattedSecondPhone) {
        return NextResponse.json({ 
          error: "Secondary driver phone number must be exactly 10 digits" 
        }, { status: 400 });
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

    return NextResponse.json({
      ok: true,
      message: "Driver information updated successfully"
    });

  } catch (error) {
    console.error("Error updating driver information:", error);
    return NextResponse.json(
      { error: "Failed to update driver information", details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

