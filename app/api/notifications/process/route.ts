import { addSecurityHeaders, logSecurityEvent } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from '@/lib/db';
import { notificationQueue, urgentNotificationQueue } from '@/lib/notification-queue';
import { NextRequest, NextResponse } from "next/server";

// This service enqueues notification jobs instead of processing directly
// Actual processing happens in worker processes
export async function POST(request: NextRequest) {
  try {
    // Require admin authentication for notification processing
    const auth = await requireApiAdmin(request);
    const userId = auth.userId;

    // Check rate limit for admin write operation (processing can be resource-intensive)
    const rateLimit = await checkApiRateLimit(request, {
      userId,
      routeType: 'admin'
    });

    if (!rateLimit.allowed) {
      const response = NextResponse.json(
        {
          success: false,
          error: 'Rate limit exceeded',
          message: `Too many requests. Please try again after ${rateLimit.retryAfter} seconds.`,
          retryAfter: rateLimit.retryAfter
        },
        { status: 429 }
      );
      return addRateLimitHeaders(addSecurityHeaders(response, request), rateLimit);
    }
    
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

    logSecurityEvent('notification_jobs_enqueued', userId, { 
      usersProcessed: enqueuedCount,
      totalTriggers: allTriggers.length
    });
    
    const response = NextResponse.json({
      ok: true,
      message: `Enqueued ${enqueuedCount} notification jobs`,
      usersProcessed: enqueuedCount,
      totalTriggers: allTriggers.length,
    });
    
    return addSecurityHeaders(response, request);

  } catch (error: any) {
    console.error("Error enqueueing notification jobs:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('notification_jobs_enqueue_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to enqueue notification jobs",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response, request);
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

