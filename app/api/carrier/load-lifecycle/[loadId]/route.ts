import sql from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ loadId: string }> }
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { loadId } = await params;

    // First, determine if loadId is a UUID or integer
    // If it's an integer, we need to find the corresponding load offer ID
    let loadOfferId = loadId;
    
    // Check if loadId is numeric (integer from loads table)
    if (/^\d+$/.test(loadId)) {
      // Find the load offer ID for this load ID
      const loadOfferResult = await sql`
        SELECT lo.id as load_offer_id
        FROM loads l
        INNER JOIN load_offers lo ON l.rr_number = lo.load_rr_number
        WHERE l.id = ${parseInt(loadId)}
          AND lo.carrier_user_id = ${userId}
          AND lo.status IN ('accepted', 'assigned', 'checked_in', 'picked_up', 'departed', 'in_transit', 'delivered', 'completed')
        LIMIT 1
      `;
      
      if (loadOfferResult.length === 0) {
        return NextResponse.json({ error: "Load not found or not accessible" }, { status: 404 });
      }
      
      loadOfferId = loadOfferResult[0].load_offer_id;
    }

    // Get load lifecycle events
    const events = await sql`
      SELECT 
        lle.id,
        lle.status,
        lle.timestamp,
        lle.check_in_time,
        lle.pickup_time,
        lle.departure_time,
        lle.check_in_delivery_time,
        lle.notes,
        lle.location,
        lle.photos,
        lle.documents,
        lle.event_type,
        lle.driver_name,
        lle.driver_phone,
        lle.driver_email,
        lle.driver_license_number,
        lle.driver_license_state,
        lle.truck_number,
        lle.trailer_number,
        lle.second_driver_name,
        lle.second_driver_phone,
        lle.second_driver_email,
        lle.second_driver_license_number,
        lle.second_driver_license_state,
        lle.second_truck_number,
        lle.second_trailer_number,
        lo.status as current_status
      FROM load_lifecycle_events lle
      INNER JOIN load_offers lo ON lle.load_offer_id = lo.id
      WHERE lo.carrier_user_id = ${userId}
        AND lo.id = ${loadOfferId}
      ORDER BY lle.timestamp ASC
    `;

    const currentStatus = events.length > 0 ? events[events.length - 1].status : 'pending';

    return NextResponse.json({
      ok: true,
      data: {
        events: events.map(event => ({
          id: event.id,
          status: event.status,
          timestamp: event.timestamp,
          check_in_time: event.check_in_time,
          pickup_time: event.pickup_time,
          departure_time: event.departure_time,
          check_in_delivery_time: event.check_in_delivery_time,
          notes: event.notes,
          location: event.location,
          photos: event.photos || [],
          documents: event.documents || [],
          event_type: event.event_type || 'status_change',
          driver_info: {
            driver_name: event.driver_name,
            driver_phone: event.driver_phone,
            driver_email: event.driver_email,
            driver_license_number: event.driver_license_number,
            driver_license_state: event.driver_license_state,
            truck_number: event.truck_number,
            trailer_number: event.trailer_number,
            second_driver_name: event.second_driver_name,
            second_driver_phone: event.second_driver_phone,
            second_driver_email: event.second_driver_email,
            second_driver_license_number: event.second_driver_license_number,
            second_driver_license_state: event.second_driver_license_state,
            second_truck_number: event.second_truck_number,
            second_trailer_number: event.second_trailer_number
          }
        })),
        currentStatus
      }
    });

  } catch (error) {
    console.error("Error fetching load lifecycle:", error);
    return NextResponse.json(
      { error: "Failed to fetch load lifecycle" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ loadId: string }> }
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { loadId } = await params;
    const { 
      status: newStatus, 
      notes, 
      location,
      event_type = 'status_change',
      driver_info,
      check_in_time,
      pickup_time,
      departure_time,
      check_in_delivery_time
    } = await request.json();

    console.log('Load lifecycle update request:', {
      loadId,
      newStatus,
      notes,
      location,
      event_type,
      driver_info,
      check_in_time,
      pickup_time,
      departure_time,
      check_in_delivery_time
    });


    // First, determine if loadId is a UUID or integer
    // If it's an integer, we need to find the corresponding load offer ID
    let loadOfferId = loadId;
    
    // Check if loadId is numeric (integer from loads table)
    if (/^\d+$/.test(loadId)) {
      // Find the load offer ID for this load ID
      const loadOfferResult = await sql`
        SELECT lo.id as load_offer_id
        FROM loads l
        INNER JOIN load_offers lo ON l.rr_number = lo.load_rr_number
        WHERE l.id = ${parseInt(loadId)}
          AND lo.carrier_user_id = ${userId}
          AND lo.status IN ('accepted', 'assigned', 'checked_in', 'picked_up', 'departed', 'in_transit', 'delivered', 'completed')
        LIMIT 1
      `;
      
      if (loadOfferResult.length === 0) {
        return NextResponse.json({ error: "Load not found or not accessible" }, { status: 404 });
      }
      
      loadOfferId = loadOfferResult[0].load_offer_id;
    }

    // Validate status transition
    const validTransitions = {
      accepted: ['assigned'],
      assigned: ['checked_in'],
      checked_in: ['picked_up'],
      picked_up: ['departed'],
      departed: ['in_transit'],
      in_transit: ['checked_in_delivery'],
      checked_in_delivery: ['delivered'],
      delivered: ['completed']
    };

    // Get current load offer status
    const loadOffer = await sql`
      SELECT id, status FROM load_offers 
      WHERE id = ${loadOfferId} AND carrier_user_id = ${userId}
    `;

    if (loadOffer.length === 0) {
      return NextResponse.json({ error: "Load not found" }, { status: 404 });
    }

    const currentLoadOfferStatus = loadOffer[0].status;
    
    // Use load_offers.status for all status validation
    const currentStatus = currentLoadOfferStatus;
    
    console.log('Status validation:', {
      currentStatus,
      newStatus,
      currentLoadOfferStatus
    });

    // Allow same-status updates for lifecycle events (e.g., updating check-in time)
    const isSameStatusUpdate = currentStatus === newStatus;
    const isValidTransition = validTransitions[currentStatus as keyof typeof validTransitions]?.includes(newStatus);
    
    if (!isSameStatusUpdate && !isValidTransition) {
      return NextResponse.json({ 
        error: `Invalid status transition from ${currentStatus} to ${newStatus}` 
      }, { status: 400 });
    }

    // Create lifecycle event
    const submissionTime = new Date();
    console.log('Creating lifecycle event with:', {
      submissionTime: submissionTime.toISOString(),
      check_in_time: check_in_time,
      pickup_time: pickup_time,
      departure_time: departure_time,
      check_in_delivery_time: check_in_delivery_time
    });

    const eventResult = await sql`
      INSERT INTO load_lifecycle_events (
        load_offer_id,
        status,
        timestamp,
        check_in_time,
        pickup_time,
        departure_time,
        check_in_delivery_time,
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
        ${newStatus},
        ${submissionTime},
        ${check_in_time ? new Date(check_in_time) : null},
        ${pickup_time ? new Date(pickup_time) : null},
        ${departure_time ? new Date(departure_time) : null},
        ${check_in_delivery_time ? new Date(check_in_delivery_time) : null},
        ${notes || null},
        ${location || null},
        ${event_type},
        ${driver_info?.driver_name || null},
        ${driver_info?.driver_phone || null},
        ${driver_info?.driver_email || null},
        ${driver_info?.driver_license_number || null},
        ${driver_info?.driver_license_state || null},
        ${driver_info?.truck_number || null},
        ${driver_info?.trailer_number || null},
        ${driver_info?.second_driver_name || null},
        ${driver_info?.second_driver_phone || null},
        ${driver_info?.second_driver_email || null},
        ${driver_info?.second_driver_license_number || null},
        ${driver_info?.second_driver_license_state || null},
        ${driver_info?.second_truck_number || null},
        ${driver_info?.second_trailer_number || null},
        CURRENT_TIMESTAMP
      ) RETURNING id, timestamp
    `;

    // Update load offer status for all lifecycle statuses
    if (['assigned', 'checked_in', 'picked_up', 'departed', 'in_transit', 'checked_in_delivery', 'delivered', 'completed'].includes(newStatus)) {
      console.log('Updating load_offers status:', {
        loadOfferId,
        newStatus,
        userId
      });
      
      const updateResult = await sql`
        UPDATE load_offers 
        SET 
          status = ${newStatus},
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${loadOfferId} AND carrier_user_id = ${userId}
        RETURNING id, status
      `;
      
      console.log('Load offer status update result:', updateResult);
    }

    console.log('Event created successfully:', {
      eventId: eventResult[0].id,
      storedTimestamp: eventResult[0].timestamp,
      submissionTime: submissionTime.toISOString()
    });

    return NextResponse.json({
      ok: true,
      data: {
        eventId: eventResult[0].id,
        timestamp: eventResult[0].timestamp,
        status: newStatus
      }
    });

  } catch (error) {
    console.error("Error updating load lifecycle:", error);
    return NextResponse.json(
      { error: "Failed to update load lifecycle" },
      { status: 500 }
    );
  }
}
