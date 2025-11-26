import { NextRequest, NextResponse } from "next/server";
import { notificationQueue, urgentNotificationQueue } from '@/lib/notification-queue';
import sql from '@/lib/db';

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

    // Get all active triggers grouped by user
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

    // Also get users with state preferences enabled who don't have a similar_load trigger
    // This ensures state preference notifications work automatically
    const usersWithStatePrefs = await sql`
      SELECT DISTINCT
        cnp.supabase_carrier_user_id,
        cnp.state_preferences,
        cnp.distance_threshold_miles,
        cnp.similar_load_notifications
      FROM carrier_notification_preferences cnp
      WHERE cnp.similar_load_notifications = true
        AND cnp.state_preferences IS NOT NULL
        AND array_length(cnp.state_preferences, 1) > 0
        AND NOT EXISTS (
          SELECT 1 FROM notification_triggers nt
          WHERE nt.supabase_carrier_user_id = cnp.supabase_carrier_user_id
            AND nt.trigger_type = 'similar_load'
            AND nt.is_active = true
        )
    `;

    // Add virtual similar_load triggers for users with state preferences
    for (const userPref of usersWithStatePrefs) {
      allTriggers.push({
        id: -1, // Virtual trigger ID
        supabase_carrier_user_id: userPref.supabase_carrier_user_id,
        trigger_type: 'similar_load',
        trigger_config: {
          statePreferences: userPref.state_preferences,
          distanceThreshold: userPref.distance_threshold_miles || 50,
        },
        is_active: true,
      });
    }

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
      
      await queue.add(
        `process-user-${userId}`,
        {
          userId,
          triggers: triggers.map(t => ({
            id: t.id,
            triggerType: t.trigger_type,
            triggerConfig: t.trigger_config,
          })),
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



