import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { requireApiCarrier, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bidNumber: string }> }
) {
  try {
    const { bidNumber } = await params;
    
    const auth = await requireApiCarrier(request);
    const userId = auth.userId;

    // Check rate limit for read-only carrier operation
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

    // Get lifecycle events for this bid
    const events = await sql`
      SELECT 
        id,
        bid_id,
        event_type,
        event_data,
        timestamp,
        notes,
        documents,
        location,
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
        check_in_time,
        pickup_time,
        departure_time,
        check_in_delivery_time,
        delivery_time
      FROM bid_lifecycle_events
      WHERE bid_id = ${bidNumber}
      ORDER BY timestamp ASC
    `;

    // Get current bid status from carrier_bids table
    const currentStatus = await sql`
      SELECT status 
      FROM carrier_bids 
      WHERE bid_number = ${bidNumber} AND supabase_user_id = ${userId}
      LIMIT 1
    `;

    // Get bid details for complete information
    // Note: winner_user_id was removed in migration 078, only supabase_winner_user_id exists
    // IMPORTANT: margin_cents is NEVER exposed to carriers - admin-only analytics data
    const bidDetails = await sql`
      SELECT 
        aa.bid_number,
        aa.winner_amount_cents,
        aa.awarded_at,
        tb.distance_miles,
        tb.pickup_timestamp,
        tb.delivery_timestamp,
        tb.stops,
        tb.tag,
        tb.source_channel,
        cb.driver_name,
        cb.driver_phone,
        cb.truck_number,
        cb.trailer_number,
        cb.lifecycle_notes
        -- margin_cents is intentionally excluded - admin-only analytics data
      FROM auction_awards aa
      LEFT JOIN telegram_bids tb ON aa.bid_number = tb.bid_number
      LEFT JOIN carrier_bids cb ON aa.bid_number = cb.bid_number 
        AND cb.supabase_user_id = aa.supabase_winner_user_id
      WHERE aa.bid_number = ${bidNumber} 
        AND aa.supabase_winner_user_id = ${userId}
        -- margin_cents is intentionally excluded - admin-only analytics data
      LIMIT 1
    `;

    logSecurityEvent('bid_lifecycle_accessed', userId, { bidNumber });
    
    const response = NextResponse.json({
      ok: true,
      data: {
        events,
        currentStatus: currentStatus[0]?.status || 'bid_awarded',
        bidDetails: bidDetails[0] || null
      }
    });
    
    return addRateLimitHeaders(addSecurityHeaders(response), rateLimit);

  } catch (error: any) {
    console.error("Error fetching bid lifecycle events:", error);
    
    if (error.message === "Unauthorized" || error.message === "Carrier access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('bid_lifecycle_fetch_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to fetch lifecycle events",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ bidNumber: string }> }
) {
  try {
    const { bidNumber } = await params;
    
    const auth = await requireApiCarrier(request);
    const userId = auth.userId;

    // Input validation
    const validation = validateInput(
      { bidNumber },
      {
        bidNumber: { 
          required: true, 
          type: 'string', 
          pattern: /^[A-Z0-9\-_]+$/,
          maxLength: 100
        }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_bid_lifecycle_post_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    const { 
      status, 
      notes, 
      location,
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
      check_in_time,
      pickup_time,
      departure_time,
      check_in_delivery_time,
      delivery_time
    } = await request.json();

    // Input validation for POST body
    const bodyValidation = validateInput(
      { status, driver_name, driver_phone, driver_email, driver_license_number, driver_license_state },
      {
        status: { required: true, type: 'string', enum: ['bid_awarded', 'load_assigned', 'driver_info_update', 'checked_in_origin', 'picked_up', 'departed_origin', 'in_transit', 'checked_in_destination', 'delivered', 'completed'] },
        driver_name: { type: 'string', maxLength: 100, required: false },
        driver_phone: { type: 'string', maxLength: 20, required: false },
        driver_email: { type: 'string', pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, maxLength: 255, required: false },
        driver_license_number: { type: 'string', maxLength: 50, required: false },
        driver_license_state: { type: 'string', maxLength: 2, required: false }
      }
    );

    if (!bodyValidation.valid) {
      logSecurityEvent('invalid_bid_lifecycle_post_body', userId, { errors: bodyValidation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${bodyValidation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    if (!status) {
      const response = NextResponse.json(
        { error: "Status is required" },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // Validate status transition
    const validStatuses = [
      'bid_awarded', 'load_assigned', 'driver_info_update', 'checked_in_origin', 'picked_up',
      'departed_origin', 'in_transit', 'checked_in_destination', 'delivered', 'completed'
    ];

    if (!validStatuses.includes(status)) {
      const response = NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // Verify the user owns this bid
    // Note: winner_user_id was removed in migration 078, only supabase_winner_user_id exists
    const bidOwnership = await sql`
      SELECT 1 FROM auction_awards 
      WHERE bid_number = ${bidNumber} 
        AND supabase_winner_user_id = ${userId}
    `;

    if (bidOwnership.length === 0) {
      logSecurityEvent('bid_lifecycle_unauthorized_access', userId, { bidNumber });
      const response = NextResponse.json(
        { error: "Bid not found or not authorized" },
        { status: 404 }
      );
      return addSecurityHeaders(response);
    }

    // Get current status to validate transition
    const currentBidStatus = await sql`
      SELECT status FROM carrier_bids 
      WHERE bid_number = ${bidNumber} AND supabase_user_id = ${userId}
      LIMIT 1
    `;

    const currentStatus = currentBidStatus[0]?.status || 'bid_awarded';

    // Validate status transition (basic validation)
    const statusOrder = [
      'bid_awarded', 'load_assigned', 'checked_in_origin', 'picked_up',
      'departed_origin', 'in_transit', 'checked_in_destination', 'delivered', 'completed'
    ];
    
    // Special case: driver_info_update can happen at any time after load_assigned
    if (status === 'driver_info_update') {
      if (currentStatus === 'bid_awarded') {
        return NextResponse.json(
          { error: "Cannot update driver info before load is assigned" },
          { status: 400 }
        );
      }
      // Allow driver_info_update at any other status
    } else if (status === 'bid_awarded') {
      // Special case: Allow accepting an awarded bid (creating initial lifecycle event)
      // This is when carrier clicks "Accept Bid" button
      if (currentStatus !== 'awarded') {
        return NextResponse.json(
          { error: `Cannot accept bid. Current status is ${currentStatus}, expected 'awarded'` },
          { status: 400 }
        );
      }
      // Allow transition from 'awarded' to 'bid_awarded'
    } else {
      // Normal status progression validation
      const currentIndex = statusOrder.indexOf(currentStatus);
      const newIndex = statusOrder.indexOf(status);
      
      if (newIndex < currentIndex) {
        return NextResponse.json(
          { error: `Cannot transition from ${currentStatus} to ${status}. Status must progress forward.` },
          { status: 400 }
        );
      }
    }

    // Insert lifecycle event
    const result = await sql`
      INSERT INTO bid_lifecycle_events (
        bid_id, 
        event_type, 
        event_data, 
        notes, 
        location,
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
        check_in_time,
        pickup_time,
        departure_time,
        check_in_delivery_time,
        delivery_time,
        timestamp
      )
      VALUES (
        ${bidNumber}, 
        ${status}, 
        ${JSON.stringify({ previous_status: currentStatus, updated_at: new Date().toISOString() })}, 
        ${notes || null}, 
        ${location || null},
        ${driver_name || null},
        ${driver_phone || null},
        ${driver_email || null},
        ${driver_license_number || null},
        ${driver_license_state || null},
        ${truck_number || null},
        ${trailer_number || null},
        ${second_driver_name || null},
        ${second_driver_phone || null},
        ${second_driver_email || null},
        ${second_driver_license_number || null},
        ${second_driver_license_state || null},
        ${second_truck_number || null},
        ${second_trailer_number || null},
        ${check_in_time || null},
        ${pickup_time || null},
        ${departure_time || null},
        ${check_in_delivery_time || null},
        ${delivery_time || null},
        CURRENT_TIMESTAMP
      )
      RETURNING id
    `;

    // Notify admins when carrier accepts a bid
    if (status === 'bid_awarded') {
      try {
        const { notifyAllAdmins, getCarrierProfileInfo } = await import('@/lib/notifications');
        
        // Get carrier profile info
        const carrierProfile = await getCarrierProfileInfo(userId);
        const carrierName = carrierProfile?.legalName || carrierProfile?.companyName || 'Unknown Carrier';
        const mcNumber = carrierProfile?.mcNumber || 'N/A';
        
        // Get bid award details for amount
        const awardDetails = await sql`
          SELECT winner_amount_cents
          FROM auction_awards
          WHERE bid_number = ${bidNumber}
          LIMIT 1
        `;
        
        const amountCents = awardDetails[0]?.winner_amount_cents || 0;
        const amountDollars = (amountCents / 100).toFixed(2);
        
        // Notify all admins
        await notifyAllAdmins(
          'bid_accepted',
          '✅ Bid Accepted',
          `${carrierName} (MC: ${mcNumber}) accepted Bid #${bidNumber} for $${amountDollars}`,
          {
            bid_number: bidNumber,
            carrier_user_id: userId,
            carrier_name: carrierName,
            mc_number: mcNumber,
            amount_cents: amountCents,
            amount_dollars: amountDollars,
            accepted_at: new Date().toISOString()
          }
        );
      } catch (notificationError) {
        console.error('Failed to create admin notification for bid acceptance:', notificationError);
        // Don't throw - bid acceptance should still succeed
      }
    }

    // Update the bid status in carrier_bids table
    // For driver_info_update, don't change the main status, just update driver info
    if (status === 'driver_info_update') {
      await sql`
        UPDATE carrier_bids SET
          driver_name = COALESCE(${driver_name || null}, driver_name),
          driver_phone = COALESCE(${driver_phone || null}, driver_phone),
          driver_email = COALESCE(${driver_email || null}, driver_email),
          driver_license_number = COALESCE(${driver_license_number || null}, driver_license_number),
          driver_license_state = COALESCE(${driver_license_state || null}, driver_license_state),
          truck_number = COALESCE(${truck_number || null}, truck_number),
          trailer_number = COALESCE(${trailer_number || null}, trailer_number),
          second_driver_name = COALESCE(${second_driver_name || null}, second_driver_name),
          second_driver_phone = COALESCE(${second_driver_phone || null}, second_driver_phone),
          second_driver_email = COALESCE(${second_driver_email || null}, second_driver_email),
          second_driver_license_number = COALESCE(${second_driver_license_number || null}, second_driver_license_number),
          second_driver_license_state = COALESCE(${second_driver_license_state || null}, second_driver_license_state),
          second_truck_number = COALESCE(${second_truck_number || null}, second_truck_number),
          second_trailer_number = COALESCE(${second_trailer_number || null}, second_trailer_number),
          updated_at = CURRENT_TIMESTAMP
        WHERE bid_number = ${bidNumber} AND supabase_user_id = ${userId}
      `;
    } else {
      // Normal status update - Supabase-only
      // First try to find existing record
      const existingBid = await sql`
        SELECT id FROM carrier_bids
        WHERE bid_number = ${bidNumber} AND supabase_user_id = ${userId}
        LIMIT 1
      `;
      
      if (existingBid.length > 0) {
        // Update existing record
        await sql`
          UPDATE carrier_bids SET
            status = ${status},
            lifecycle_notes = ${notes || null},
            driver_name = COALESCE(${driver_name || null}, driver_name),
            driver_phone = COALESCE(${driver_phone || null}, driver_phone),
            driver_email = COALESCE(${driver_email || null}, driver_email),
            driver_license_number = COALESCE(${driver_license_number || null}, driver_license_number),
            driver_license_state = COALESCE(${driver_license_state || null}, driver_license_state),
            truck_number = COALESCE(${truck_number || null}, truck_number),
            trailer_number = COALESCE(${trailer_number || null}, trailer_number),
            second_driver_name = COALESCE(${second_driver_name || null}, second_driver_name),
            second_driver_phone = COALESCE(${second_driver_phone || null}, second_driver_phone),
            second_driver_email = COALESCE(${second_driver_email || null}, second_driver_email),
            second_driver_license_number = COALESCE(${second_driver_license_number || null}, second_driver_license_number),
            second_driver_license_state = COALESCE(${second_driver_license_state || null}, second_driver_license_state),
            second_truck_number = COALESCE(${second_truck_number || null}, second_truck_number),
            second_trailer_number = COALESCE(${second_trailer_number || null}, second_trailer_number),
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ${existingBid[0].id}
        `;
      } else {
        // Insert new record (Supabase-only)
        await sql`
          INSERT INTO carrier_bids (
            bid_number, 
            supabase_user_id,
            amount_cents, 
            status, 
            lifecycle_notes,
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
            updated_at
          )
          VALUES (
            ${bidNumber}, 
            ${userId},
            0, 
            ${status}, 
            ${notes || null},
            ${driver_name || null},
            ${driver_phone || null},
            ${driver_email || null},
            ${driver_license_number || null},
            ${driver_license_state || null},
            ${truck_number || null},
            ${trailer_number || null},
            ${second_driver_name || null},
            ${second_driver_phone || null},
            ${second_driver_email || null},
            ${second_driver_license_number || null},
            ${second_driver_license_state || null},
            ${second_truck_number || null},
            ${second_trailer_number || null},
            CURRENT_TIMESTAMP
          )
          ON CONFLICT (bid_number, supabase_user_id)
          DO UPDATE SET 
            status = ${status},
            lifecycle_notes = ${notes || null},
            driver_name = COALESCE(${driver_name || null}, carrier_bids.driver_name),
            driver_phone = COALESCE(${driver_phone || null}, carrier_bids.driver_phone),
            driver_email = COALESCE(${driver_email || null}, carrier_bids.driver_email),
            driver_license_number = COALESCE(${driver_license_number || null}, carrier_bids.driver_license_number),
            driver_license_state = COALESCE(${driver_license_state || null}, carrier_bids.driver_license_state),
            truck_number = COALESCE(${truck_number || null}, carrier_bids.truck_number),
            trailer_number = COALESCE(${trailer_number || null}, carrier_bids.trailer_number),
            second_driver_name = COALESCE(${second_driver_name || null}, carrier_bids.second_driver_name),
            second_driver_phone = COALESCE(${second_driver_phone || null}, carrier_bids.second_driver_phone),
            second_driver_email = COALESCE(${second_driver_email || null}, carrier_bids.second_driver_email),
            second_driver_license_number = COALESCE(${second_driver_license_number || null}, carrier_bids.second_driver_license_number),
            second_driver_license_state = COALESCE(${second_driver_license_state || null}, carrier_bids.second_driver_license_state),
            second_truck_number = COALESCE(${second_truck_number || null}, carrier_bids.second_truck_number),
            second_trailer_number = COALESCE(${second_trailer_number || null}, carrier_bids.second_trailer_number),
            updated_at = CURRENT_TIMESTAMP
        `;
      }
    }

    logSecurityEvent('bid_lifecycle_event_created', userId, { 
      bidNumber, 
      status, 
      eventId: result[0].id 
    });
    
    const response = NextResponse.json({
      ok: true,
      data: {
        eventId: result[0].id,
        message: "Status updated successfully",
        newStatus: status,
        previousStatus: currentStatus
      }
    });
    
    return addSecurityHeaders(response);

  } catch (error: any) {
    console.error("Error creating lifecycle event:", error);
    
    if (error.message === "Unauthorized" || error.message === "Carrier access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('bid_lifecycle_event_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to create lifecycle event",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}
