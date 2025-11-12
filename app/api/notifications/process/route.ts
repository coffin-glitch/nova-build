import sql from '@/lib/db';
import { notificationQueue, urgentNotificationQueue } from '@/lib/notification-queue';
import { NextRequest, NextResponse } from "next/server";

// This service enqueues notification jobs instead of processing directly
// Actual processing happens in worker processes
export async function POST(request: NextRequest) {
  try {
    console.log("Starting notification job enqueueing...");
    
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

    console.log(`Notification job enqueueing completed. Enqueued ${enqueuedCount} user jobs.`);

    return NextResponse.json({
      ok: true,
      message: `Enqueued ${enqueuedCount} notification jobs`,
      usersProcessed: enqueuedCount,
      totalTriggers: allTriggers.length,
    });

  } catch (error) {
    console.error("Error enqueueing notification jobs:", error);
    return NextResponse.json(
      { error: "Failed to enqueue notification jobs", details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Legacy endpoint for direct processing (kept for backward compatibility during migration)
export async function PUT(request: NextRequest) {
  try {
    console.log("Legacy direct processing endpoint called...");
    
    // Process different types of notifications directly (old way)
    const results = {
      similarLoads: await processSimilarLoadNotifications(),
      exactMatches: await processExactMatchNotifications(),
      newRoutes: await processNewRouteNotifications(),
      favoriteAvailable: await processFavoriteAvailableNotifications(),
      deadlineApproaching: await processDeadlineApproachingNotifications()
    };

    const totalProcessed = Object.values(results).reduce((sum, count) => sum + count, 0);

    console.log(`Legacy notification processing completed. Processed ${totalProcessed} notifications.`);

    return NextResponse.json({
      ok: true,
      message: `Processed ${totalProcessed} notifications (legacy mode)`,
      results
    });

  } catch (error) {
    console.error("Error processing notifications:", error);
    return NextResponse.json(
      { error: "Failed to process notifications" },
      { status: 500 }
    );
  }
}

// Import legacy processing functions (kept for backward compatibility)
import {
  processDeadlineApproachingNotifications,
  processExactMatchNotifications,
  processFavoriteAvailableNotifications,
  processNewRouteNotifications,
  processSimilarLoadNotifications
} from './process-legacy';

