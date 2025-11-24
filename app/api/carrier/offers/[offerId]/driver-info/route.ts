import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { requireApiCarrier, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ offerId: string }> }
) {
  try {
    const auth = await requireApiCarrier(request);
    const userId = auth.userId;

    // Check rate limit for authenticated write operation
    const rateLimit = await checkApiRateLimit(request, {
      userId,
      routeType: 'authenticated'
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

    // Input validation
    const validation = validateInput(
      { offerId, driver_name, driver_phone, driver_email, driver_license_number, driver_license_state, truck_number, trailer_number },
      {
        offerId: { required: true, type: 'string', maxLength: 50 },
        driver_name: { required: true, type: 'string', minLength: 1, maxLength: 100 },
        driver_phone: { required: true, type: 'string', pattern: /^[\d\s\-\(\)]+$/, maxLength: 20 },
        driver_email: { type: 'string', pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, maxLength: 255, required: false },
        driver_license_number: { required: true, type: 'string', minLength: 1, maxLength: 50 },
        driver_license_state: { required: true, type: 'string', pattern: /^[A-Z]{2}$/, maxLength: 2 },
        truck_number: { type: 'string', maxLength: 50, required: false },
        trailer_number: { type: 'string', maxLength: 50, required: false }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_driver_info_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // Validate required fields
    if (!driver_name || !driver_phone || !driver_license_number || !driver_license_state) {
      const response = NextResponse.json(
        { error: "Missing required fields: driver_name, driver_phone, driver_license_number, driver_license_state" },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // Check if offer exists and belongs to this carrier
    const offerResult = await sql`
      SELECT * FROM load_offers 
      WHERE id = ${id} AND supabase_user_id = ${userId}
    `;

    if (offerResult.length === 0) {
      logSecurityEvent('offer_driver_info_unauthorized', userId, { offerId });
      const response = NextResponse.json(
        { error: "Offer not found or access denied" },
        { status: 404 }
      );
      return addSecurityHeaders(response);
    }

    const offer = offerResult[0];

    // Check if offer is accepted and driver info is required
    if (offer.status !== 'accepted') {
      const response = NextResponse.json(
        { error: "Driver information can only be submitted for accepted offers" },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    if (!offer.driver_info_required) {
      const response = NextResponse.json(
        { error: "Driver information is not required for this offer" },
        { status: 400 }
      );
      return addSecurityHeaders(response);
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

    logSecurityEvent('driver_info_submitted', userId, { offerId });
    
    const response = NextResponse.json({ 
      success: true,
      message: "Driver information submitted successfully",
      offer: updateResult[0]
    });
    
    return addSecurityHeaders(response);

  } catch (error: any) {
    console.error("Error submitting driver information:", error);
    
    if (error.message === "Unauthorized" || error.message === "Carrier access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('driver_info_submit_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Internal server error",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
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

    // Input validation
    const validation = validateInput(
      { offerId },
      {
        offerId: { required: true, type: 'string', maxLength: 50 }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_offer_driver_info_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // Carrier can only see their own offers
    const offerResult = await sql`
      SELECT * FROM load_offers 
      WHERE id = ${id} AND supabase_user_id = ${userId}
    `;

    if (offerResult.length === 0) {
      logSecurityEvent('offer_driver_info_not_found', userId, { offerId });
      const response = NextResponse.json(
        { error: "Offer not found" },
        { status: 404 }
      );
      return addSecurityHeaders(response);
    }

    logSecurityEvent('offer_driver_info_accessed', userId, { offerId });
    
    const response = NextResponse.json({ 
      success: true,
      offer: offerResult[0]
    });
    
    return addSecurityHeaders(response);

  } catch (error: any) {
    console.error("Error fetching offer:", error);
    
    if (error.message === "Unauthorized" || error.message === "Carrier access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('offer_driver_info_fetch_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Internal server error",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}
