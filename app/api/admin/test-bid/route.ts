import sql from '@/lib/db';
import { notificationQueue, urgentNotificationQueue } from '@/lib/notification-queue';
import { NextRequest, NextResponse } from "next/server";

/**
 * Admin endpoint to create a test bid for notification testing
 * Can accept custom route via request body, or uses default route
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    
    // Allow custom bid number and route via request body
    const testBidNumber = body.bidNumber || `TEST${Date.now()}`;
    const customRoute = body.route; // e.g., { origin: "LOS ANGELES, CA 90052", destination: "GROVEPORT, OH 43125", distance: 2200 }
    
    const now = new Date();
    const pickupTime = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours from now
    const deliveryTime = new Date(pickupTime.getTime() + 24 * 60 * 60 * 1000); // 24 hours after pickup
    const expiresAt = new Date(now.getTime() + 25 * 60 * 1000); // 25 minutes from now
    
    // Use custom route if provided, otherwise default route
    const stopsArray = customRoute 
      ? [customRoute.origin, customRoute.destination]
      : ['SALT LAKE CITY, UT 84199', 'AVONDALE, AZ 85323'];
    const stopsJson = JSON.stringify(stopsArray);
    const distance = customRoute?.distance || 650; // Use custom distance or default
    
    // Insert test bid
    await sql`
      INSERT INTO public.telegram_bids (
        bid_number,
        distance_miles,
        pickup_timestamp,
        delivery_timestamp,
        stops,
        tag,
        source_channel,
        received_at,
        expires_at
      )
      VALUES (
        ${testBidNumber},
        ${distance},
        ${pickupTime.toISOString()},
        ${deliveryTime.toISOString()},
        ${stopsJson}::jsonb,
        'TEST',
        'test-script',
        ${now.toISOString()},
        ${expiresAt.toISOString()}
      )
      ON CONFLICT (bid_number) DO UPDATE SET
        distance_miles = EXCLUDED.distance_miles,
        pickup_timestamp = EXCLUDED.pickup_timestamp,
        delivery_timestamp = EXCLUDED.delivery_timestamp,
        stops = EXCLUDED.stops,
        tag = EXCLUDED.tag,
        source_channel = EXCLUDED.source_channel,
        received_at = EXCLUDED.received_at,
        expires_at = EXCLUDED.expires_at
    `;
    
    // Trigger notification processing directly (same as webhook does)
    console.log(`[Admin Test Bid] Triggering notifications for bid ${testBidNumber}`);
    
    // Get all active triggers grouped by user (same logic as webhook)
    // This includes:
    // 1. Exact match triggers (matchType: 'exact')
    // 2. State match triggers (matchType: 'state')
    // 3. Similar load triggers (state preference)
    const allTriggers = await sql`
      SELECT 
        nt.id,
        nt.supabase_carrier_user_id,
        nt.trigger_type,
        nt.trigger_config,
        nt.is_active
      FROM notification_triggers nt
      WHERE nt.is_active = true
      ORDER BY nt.supabase_carrier_user_id, nt.trigger_type
    `;
    
    console.log(`[Admin Test Bid] Found ${allTriggers.length} active triggers from notification_triggers table`);

    // Also get users with state preferences enabled who don't have a similar_load trigger
    // This ensures state preference notifications work automatically
    const usersWithStatePrefs = await sql`
      SELECT DISTINCT
        cnp.supabase_carrier_user_id as user_id,
        cnp.state_preferences,
        cnp.distance_threshold_miles,
        cnp.similar_load_notifications
      FROM carrier_notification_preferences cnp
      WHERE cnp.supabase_carrier_user_id IS NOT NULL
        AND cnp.similar_load_notifications = true
        AND cnp.state_preferences IS NOT NULL
        AND array_length(cnp.state_preferences, 1) > 0
        AND NOT EXISTS (
          SELECT 1 FROM notification_triggers nt
          WHERE nt.supabase_carrier_user_id = cnp.supabase_carrier_user_id
            AND nt.trigger_type = 'similar_load'
            AND nt.is_active = true
        )
    `;

    console.log(`[Admin Test Bid] Found ${usersWithStatePrefs.length} users with state preferences but no similar_load trigger`);

    // Add virtual similar_load triggers for users with state preferences
    // This enables automatic state preference notifications (type 3)
    for (const userPref of usersWithStatePrefs) {
      const userId = userPref.user_id;
      console.log(`[Admin Test Bid] Adding virtual similar_load trigger (state preference) for user ${userId}, states: ${userPref.state_preferences?.join(', ') || 'none'}`);
      allTriggers.push({
        id: -1, // Virtual trigger ID
        supabase_carrier_user_id: userId,
        trigger_type: 'similar_load',
        trigger_config: {
          statePreferences: userPref.state_preferences,
          distanceThreshold: userPref.distance_threshold_miles || 50,
        },
        is_active: true,
      });
    }
    
    console.log(`[Admin Test Bid] Total triggers after adding virtual state preference triggers: ${allTriggers.length}`);
    
    // Group triggers by user to batch process
    const userTriggers = new Map<string, any[]>();
    for (const trigger of allTriggers) {
      const userId = trigger.supabase_carrier_user_id;
      if (!userTriggers.has(userId)) {
        userTriggers.set(userId, []);
      }
      userTriggers.get(userId)!.push(trigger);
    }
    
    let enqueuedCount = 0;
    
    // Enqueue jobs for each user
    for (const [userId, triggers] of userTriggers.entries()) {
      // Determine priority based on trigger types
      const hasUrgent = triggers.some(t => 
        t.trigger_type === 'exact_match' || 
        t.trigger_type === 'deadline_approaching'
      );
      
      const queue = hasUrgent ? urgentNotificationQueue : notificationQueue;
      
      const triggerData = triggers.map(t => ({
        id: t.id,
        triggerType: t.trigger_type,
        triggerConfig: t.trigger_config,
      }));
      
      console.log(`[Admin Test Bid] Enqueueing job for user ${userId} with ${triggers.length} triggers: ${triggers.map(t => t.trigger_type).join(', ')}`);
      
      await queue.add(
        `process-user-${userId}`,
        {
          userId,
          triggers: triggerData,
        },
        {
          priority: hasUrgent ? 10 : 5,
          jobId: `user-${userId}-${Date.now()}`,
        }
      );
      
      enqueuedCount++;
    }
    
    console.log(`[Admin Test Bid] Enqueued ${enqueuedCount} notification jobs`);
    
    const webhookData = {
      usersProcessed: enqueuedCount,
      totalTriggers: allTriggers.length,
    };
    
    return NextResponse.json({
      ok: true,
      message: 'Test bid created and webhook triggered',
      bidNumber: testBidNumber,
      route: stopsArray.join(' → '),
      notifications: {
        usersProcessed: webhookData.usersProcessed || 0,
        totalTriggers: webhookData.totalTriggers || 0,
        jobsEnqueued: enqueuedCount,
      },
    });
    
  } catch (error: any) {
    console.error('[Admin Test Bid] Error:', error);
    return NextResponse.json(
      { 
        error: "Failed to create test bid",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
  }
}

