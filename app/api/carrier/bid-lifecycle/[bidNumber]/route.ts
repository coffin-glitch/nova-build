import sql from "@/lib/db";
import { requireApiCarrier } from "@/lib/auth-api-helper";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bidNumber: string }> }
) {
  try {
    const { bidNumber } = await params;
    
    const auth = await requireApiCarrier(request);
    const userId = auth.userId;

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
      FROM auction_awards aa
      LEFT JOIN telegram_bids tb ON aa.bid_number = tb.bid_number
      LEFT JOIN carrier_bids cb ON aa.bid_number = cb.bid_number 
        AND cb.supabase_user_id = aa.supabase_winner_user_id
      WHERE aa.bid_number = ${bidNumber} 
        AND aa.supabase_winner_user_id = ${userId}
      LIMIT 1
    `;

    return NextResponse.json({
      ok: true,
      data: {
        events,
        currentStatus: currentStatus[0]?.status || 'bid_awarded',
        bidDetails: bidDetails[0] || null
      }
    });

  } catch (error) {
    console.error("Error fetching bid lifecycle events:", error);
    return NextResponse.json(
      { error: "Failed to fetch lifecycle events", details: error instanceof Error ? error.message : 'Unknown error' },
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

    if (!status) {
      return NextResponse.json(
        { error: "Status is required" },
        { status: 400 }
      );
    }

    // Validate status transition
    const validStatuses = [
      'bid_awarded', 'load_assigned', 'driver_info_update', 'checked_in_origin', 'picked_up',
      'departed_origin', 'in_transit', 'checked_in_destination', 'delivered', 'completed'
    ];

    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    // Verify the user owns this bid
    // Note: winner_user_id was removed in migration 078, only supabase_winner_user_id exists
    const bidOwnership = await sql`
      SELECT 1 FROM auction_awards 
      WHERE bid_number = ${bidNumber} 
        AND supabase_winner_user_id = ${userId}
    `;

    if (bidOwnership.length === 0) {
      return NextResponse.json(
        { error: "Bid not found or not authorized" },
        { status: 404 }
      );
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

    return NextResponse.json({
      ok: true,
      data: {
        eventId: result[0].id,
        message: "Status updated successfully",
        newStatus: status,
        previousStatus: currentStatus
      }
    });

  } catch (error) {
    console.error("Error creating lifecycle event:", error);
    return NextResponse.json(
      { error: "Failed to create lifecycle event", details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
