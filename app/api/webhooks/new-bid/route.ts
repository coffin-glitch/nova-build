import sql from '@/lib/db';
import { notificationQueue, urgentNotificationQueue } from '@/lib/notification-queue';
import { NextRequest, NextResponse } from "next/server";
import { 
  getBidInfoForFiltering, 
  filterRelevantTriggers, 
  filterRelevantStatePreferenceUsers 
} from '@/lib/bid-filtering';

/**
 * Webhook endpoint to trigger notification processing when a new bid is inserted
 * This can be called from the Telegram bot forwarder or other services
 * 
 * Security: Uses a simple API key check (set WEBHOOK_API_KEY env var)
 */
export async function POST(request: NextRequest) {
  try {
    // Check webhook API key for security
    const apiKey = request.headers.get('x-webhook-key') || request.headers.get('authorization')?.replace('Bearer ', '');
    const expectedKey = process.env.WEBHOOK_API_KEY;
    
    if (expectedKey && apiKey !== expectedKey) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const bidNumber = body.bidNumber;

    console.log(`[Webhook] New bid notification trigger for bid ${bidNumber || 'all'}`);

    // OPTIMIZATION: Pre-filter triggers based on bid information
    // This dramatically reduces the number of jobs enqueued (80-95% reduction)
    let allTriggers: any[] = [];
    
    if (bidNumber) {
      // Get bid information for filtering
      const bidInfo = await getBidInfoForFiltering(bidNumber);
      
      if (bidInfo) {
        console.log(`[Webhook] Extracted bid info: ${bidInfo.origin} → ${bidInfo.destination} (${bidInfo.originState} → ${bidInfo.destinationState})`);
        
        // Filter triggers that could potentially match this bid
        allTriggers = await filterRelevantTriggers(bidInfo);
        
        console.log(`[Webhook] Found ${allTriggers.length} relevant triggers after filtering (vs checking all triggers)`);
      } else {
        // Fallback: If we can't get bid info, check all triggers (safe default)
        console.log(`[Webhook] Could not get bid info for ${bidNumber}, checking all triggers (safe fallback)`);
        allTriggers = await sql`
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
      }
    } else {
      // No bid number provided, check all triggers (safe default)
      console.log(`[Webhook] No bid number provided, checking all triggers (safe fallback)`);
      allTriggers = await sql`
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
    }

    // OPTIMIZATION: Pre-filter state preference users based on bid origin state
    let usersWithStatePrefs: any[] = [];
    
    if (bidNumber) {
      const bidInfo = await getBidInfoForFiltering(bidNumber);
      
      if (bidInfo) {
        // Only get users whose state preferences match the bid's origin state
        usersWithStatePrefs = await filterRelevantStatePreferenceUsers(bidInfo);
        
        console.log(`[Webhook] Found ${usersWithStatePrefs.length} state preference users after filtering (vs checking all users)`);
      } else {
        // Fallback: Get all state preference users (safe default)
        console.log(`[Webhook] Could not get bid info, checking all state preference users (safe fallback)`);
        usersWithStatePrefs = await sql`
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
      }
    } else {
      // No bid number, get all state preference users (safe default)
      usersWithStatePrefs = await sql`
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
    }

    // Add virtual similar_load triggers for users with state preferences
    // This enables automatic state preference notifications (type 3)
    for (const userPref of usersWithStatePrefs) {
      const userId = userPref.user_id;
      console.log(`[Webhook] Adding virtual similar_load trigger (state preference) for user ${userId}, states: ${userPref.state_preferences?.join(', ') || 'none'}`);
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
    
    console.log(`[Webhook] Total triggers after adding virtual state preference triggers: ${allTriggers.length}`);

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
      
      console.log(`[Webhook] Enqueueing job for user ${userId} with ${triggers.length} triggers: ${triggers.map(t => t.trigger_type).join(', ')}`);
      
      await queue.add(
        `process-user-${userId}`,
        {
          userId,
          triggers: triggerData,
        },
        {
          priority: hasUrgent ? 10 : 5,
          jobId: `user-${userId}-${Date.now()}`, // Unique job ID
        }
      );

      enqueuedCount++;
    }

    console.log(`[Webhook] Enqueued ${enqueuedCount} notification jobs`);

    return NextResponse.json({
      ok: true,
      message: `Enqueued ${enqueuedCount} notification jobs`,
      usersProcessed: enqueuedCount,
      totalTriggers: allTriggers.length,
      bidNumber: bidNumber || null,
    });

  } catch (error: any) {
    console.error("[Webhook] Error enqueueing notification jobs:", error);
    
    return NextResponse.json(
      { 
        error: "Failed to enqueue notification jobs",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
  }
}



