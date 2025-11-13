import { requireApiCarrier } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ offerId: string }> }
) {
  try {
    const auth = await requireApiCarrier(request);
    const userId = auth.userId;

    const { offerId } = await params;
    const id = offerId;
    const body = await request.json();
    const { 
      driver_name, 
      driver_phone, 
      driver_email, 
      driver_license_number, 
      driver_license_state, 
      truck_number, 
      trailer_number 
    } = body;

    // Validate required fields
    if (!driver_name || !driver_phone || !driver_license_number || !driver_license_state) {
      return NextResponse.json({ 
        error: "Missing required fields: driver_name, driver_phone, driver_license_number, driver_license_state" 
      }, { status: 400 });
    }

    // Check if offer exists and belongs to this carrier
    const offerResult = await sql`
      SELECT * FROM load_offers 
      WHERE id = ${id} AND supabase_user_id = ${userId}
    `;

    if (offerResult.length === 0) {
      return NextResponse.json({ error: "Offer not found or access denied" }, { status: 404 });
    }

    const offer = offerResult[0];

    // Check if offer is accepted and driver info is required
    if (offer.status !== 'accepted') {
      return NextResponse.json({ error: "Driver information can only be submitted for accepted offers" }, { status: 400 });
    }

    if (!offer.driver_info_required) {
      return NextResponse.json({ error: "Driver information is not required for this offer" }, { status: 400 });
    }

    // Update the offer with driver information
    const updateResult = await sql`
      UPDATE load_offers 
      SET 
        driver_name = ${driver_name},
        driver_phone = ${driver_phone},
        driver_email = ${driver_email || null},
        driver_license_number = ${driver_license_number},
        driver_license_state = ${driver_license_state},
        truck_number = ${truck_number || null},
        trailer_number = ${trailer_number || null},
        driver_info_submitted_at = NOW(),
        driver_info_required = false,
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    // Create notification for admin
    const carrierUserId = null; // Supabase-only now
    await sql`
      INSERT INTO carrier_notifications (
        carrier_user_id, supabase_user_id, type, title, message, priority, load_id, action_url
      ) VALUES (
        ${carrierUserId},
        ${userId},
        'driver_info_submitted',
        'Driver Information Submitted',
        'Driver information has been submitted for load ${offer.load_rr_number}.',
        'medium',
        ${id}::uuid,
        '/admin/offers'
      )
    `;

    return NextResponse.json({ 
      success: true,
      message: "Driver information submitted successfully",
      offer: updateResult[0]
    });

  } catch (error) {
    console.error("Error submitting driver information:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ offerId: string }> }
) {
  try {
    const auth = await requireApiCarrier(request);
    const userId = auth.userId;

    const { offerId } = await params;
    const id = offerId;

    // Carrier can only see their own offers
    const offerResult = await sql`
      SELECT * FROM load_offers 
      WHERE id = ${id} AND supabase_user_id = ${userId}
    `;

    if (offerResult.length === 0) {
      return NextResponse.json({ error: "Offer not found" }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true,
      offer: offerResult[0]
    });

  } catch (error) {
    console.error("Error fetching offer:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
