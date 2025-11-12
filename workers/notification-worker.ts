/**
 * Notification Worker Process
 * 
 * This worker processes notification jobs from the queue.
 * Run this as a separate process or in a separate container for horizontal scaling.
 * 
 * Usage:
 *   - Development: `tsx workers/notification-worker.ts`
 *   - Production: Run as a separate service/container
 */

// Load environment variables first
import 'dotenv/config';
import { createNotificationWorker, createUrgentNotificationWorker } from '../lib/notification-queue';
import { 
  getCachedPreferences, 
  setCachedPreferences,
  getCachedFavorites,
  setCachedFavorites,
  checkRateLimit 
} from '../lib/notification-cache';
import { shouldTriggerNotification, type AdvancedNotificationPreferences } from '../lib/advanced-notification-preferences';
import sql from '../lib/db';
import { Job } from 'bullmq';

// Process a notification job
async function processNotificationJob(job: Job) {
  const { userId, triggers } = job.data;
  
  console.log(`Processing notifications for user ${userId}, ${triggers.length} triggers`);

  // Check rate limit
  const canSend = await checkRateLimit(userId, 20, 3600);
  if (!canSend) {
    console.log(`Rate limit exceeded for user ${userId}, skipping`);
    return;
  }

  // Get cached preferences or fetch from DB
  let preferences = await getCachedPreferences(userId);
  if (!preferences) {
    const preferencesResult = await sql`
      SELECT * FROM carrier_notification_preferences
      WHERE supabase_carrier_user_id = ${userId}
      LIMIT 1
    `;
    preferences = preferencesResult[0];
    if (preferences) {
      await setCachedPreferences(userId, preferences);
    }
  }

  // Get cached favorites or fetch from DB
  let favorites = await getCachedFavorites(userId);
  if (!favorites) {
    const favoritesResult = await sql`
      SELECT 
        cf.bid_number,
        cf.created_at,
        tb.distance_miles as distance,
        tb.stops,
        tb.tag
      FROM carrier_favorites cf
      JOIN telegram_bids tb ON cf.bid_number = tb.bid_number
      WHERE cf.supabase_carrier_user_id = ${userId}
    `;
    favorites = favoritesResult;
    if (favorites.length > 0) {
      await setCachedFavorites(userId, favorites);
    }
  }

  let processedCount = 0;

  // Process each trigger
  for (const trigger of triggers) {
    try {
      const result = await processTrigger(userId, trigger, preferences, favorites);
      processedCount += result;
    } catch (error) {
      console.error(`Error processing trigger ${trigger.id} for user ${userId}:`, error);
      // Continue with other triggers
    }
  }

  console.log(`Processed ${processedCount} notifications for user ${userId}`);
  return processedCount;
}

// Process a single trigger
async function processTrigger(
  userId: string,
  trigger: { id: number; triggerType: string; triggerConfig: any },
  preferences: any,
  favorites: any[]
): Promise<number> {
  let count = 0;

  switch (trigger.triggerType) {
    case 'similar_load':
      count = await processSimilarLoadTrigger(userId, trigger, preferences, favorites);
      break;
    case 'exact_match':
      count = await processExactMatchTrigger(userId, trigger, preferences, favorites);
      break;
    case 'new_route':
      count = await processNewRouteTrigger(userId, trigger);
      break;
    case 'favorite_available':
      count = await processFavoriteAvailableTrigger(userId, trigger);
      break;
    case 'deadline_approaching':
      count = await processDeadlineApproachingTrigger(userId, trigger);
      break;
  }

  return count;
}

// Process similar load trigger
async function processSimilarLoadTrigger(
  userId: string,
  trigger: { id: number; triggerType: string; triggerConfig: any },
  preferences: any,
  favorites: any[]
): Promise<number> {
  const config = trigger.triggerConfig || {};
  const distanceThreshold = config.distanceThreshold || 50;

  // Find similar loads
  const similarLoads = await sql`
    SELECT * FROM find_similar_loads(
      ${userId},
      ${distanceThreshold},
      ${config.statePreferences || null}
    )
    WHERE similarity_score >= 70
    LIMIT 5
  `;

  let count = 0;

  for (const load of similarLoads) {
    // Check if bid is still active
    const loadBid = await sql`
      SELECT received_at
      FROM telegram_bids
      WHERE bid_number = ${load.bid_number}
      LIMIT 1
    `;
    
    if (loadBid.length === 0) continue;
    
    const bidReceivedAt = new Date(loadBid[0].received_at);
    const now = new Date();
    const minutesSinceReceived = Math.floor((now.getTime() - bidReceivedAt.getTime()) / (1000 * 60));
    const minutesRemaining = 25 - minutesSinceReceived;
    
    if (minutesRemaining <= 0) continue;
    
    // Check notification history
    const notificationHistory = await sql`
      SELECT id, sent_at
      FROM notification_logs
      WHERE supabase_carrier_user_id = ${userId}
      AND bid_number = ${load.bid_number}
      AND notification_type = 'similar_load'
      ORDER BY sent_at DESC
      LIMIT 1
    `;
    
    const shouldNotify = notificationHistory.length === 0 || 
      (notificationHistory.length > 0 && 
       new Date(notificationHistory[0].sent_at).getTime() < now.getTime() - (8 * 60 * 1000));
    
    if (!shouldNotify) continue;

    // Check if should trigger based on advanced preferences
    if (preferences) {
      const shouldTrigger = shouldTriggerNotification(
        load,
        preferences as AdvancedNotificationPreferences,
        favorites
      );

      if (shouldTrigger.shouldNotify) {
        const message = `High-match load found! ${load.bid_number} - ${load.distance_miles}mi, ${load.tag}. Match: ${shouldTrigger.matchScore || load.similarity_score}%.`;
        
        await sendNotification({
          carrierUserId: userId,
          triggerId: trigger.id,
          notificationType: 'similar_load',
          bidNumber: load.bid_number,
          message
        });
        count++;
      }
    }
  }

  return count;
}

// Process exact match trigger (simplified - full implementation needed)
async function processExactMatchTrigger(
  userId: string,
  trigger: { id: number; triggerType: string; triggerConfig: any },
  preferences: any,
  favorites: any[]
): Promise<number> {
  // TODO: Implement full exact match processing
  return 0;
}

// Process new route trigger (simplified)
async function processNewRouteTrigger(
  userId: string,
  trigger: { id: number; triggerType: string; triggerConfig: any }
): Promise<number> {
  // TODO: Implement full new route processing
  return 0;
}

// Process favorite available trigger (simplified)
async function processFavoriteAvailableTrigger(
  userId: string,
  trigger: { id: number; triggerType: string; triggerConfig: any }
): Promise<number> {
  // TODO: Implement full favorite available processing
  return 0;
}

// Process deadline approaching trigger (simplified)
async function processDeadlineApproachingTrigger(
  userId: string,
  trigger: { id: number; triggerType: string; triggerConfig: any }
): Promise<number> {
  // TODO: Implement full deadline approaching processing
  return 0;
}

// Helper function to send notifications
async function sendNotification({
  carrierUserId,
  triggerId,
  notificationType,
  bidNumber,
  message
}: {
  carrierUserId: string;
  triggerId: number;
  notificationType: string;
  bidNumber: string;
  message: string;
}) {
  try {
    // Insert into notification_logs
    await sql`
      INSERT INTO notification_logs (
        supabase_carrier_user_id,
        trigger_id,
        notification_type,
        bid_number,
        message,
        delivery_status
      )
      VALUES (
        ${carrierUserId},
        ${triggerId},
        ${notificationType},
        ${bidNumber},
        ${message},
        'sent'
      )
    `;

    // Insert into carrier_notifications for in-app notifications
    await sql`
      INSERT INTO carrier_notifications (
        supabase_carrier_user_id,
        notification_type,
        title,
        message,
        bid_number,
        is_read
      )
      VALUES (
        ${carrierUserId},
        ${notificationType},
        ${getNotificationTitle(notificationType)},
        ${message},
        ${bidNumber},
        false
      )
    `;
  } catch (error) {
    console.error("Error sending notification:", error);
    throw error; // Re-throw to trigger job retry
  }
}

function getNotificationTitle(notificationType: string): string {
  switch (notificationType) {
    case 'similar_load':
      return 'Similar Load Found';
    case 'exact_match':
      return 'Exact Match Available';
    case 'new_route':
      return 'New Route Posted';
    case 'favorite_available':
      return 'Favorite Load Available';
    case 'deadline_approaching':
      return 'Deadline Approaching';
    default:
      return 'Bid Notification';
  }
}

// Create and start workers
const notificationWorker = createNotificationWorker(processNotificationJob);
const urgentWorker = createUrgentNotificationWorker(processNotificationJob);

// Worker event handlers
notificationWorker.on('completed', (job) => {
  console.log(`✅ Notification job ${job.id} completed`);
});

notificationWorker.on('failed', (job, err) => {
  console.error(`❌ Notification job ${job?.id} failed:`, err);
});

urgentWorker.on('completed', (job) => {
  console.log(`✅ Urgent notification job ${job.id} completed`);
});

urgentWorker.on('failed', (job, err) => {
  console.error(`❌ Urgent notification job ${job?.id} failed:`, err);
});

console.log('🚀 Notification workers started and listening for jobs...');

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down workers...');
  await notificationWorker.close();
  await urgentWorker.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down workers...');
  await notificationWorker.close();
  await urgentWorker.close();
  process.exit(0);
});

