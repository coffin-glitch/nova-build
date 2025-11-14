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
import { sendEmail } from '../lib/email/notify';
import {
  ExactMatchNotificationTemplate,
  SimilarLoadNotificationTemplate,
  FavoriteAvailableNotificationTemplate,
  BidWonNotificationTemplate,
  BidLostNotificationTemplate,
  DeadlineApproachingNotificationTemplate,
} from '../lib/email-templates/notification-templates';
import sql from '../lib/db';
import { Job } from 'bullmq';
import { createClient } from '@supabase/supabase-js';

// Helper function to get carrier email from Supabase
async function getCarrierEmail(userId: string): Promise<string | null> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.warn('[Email] Supabase credentials not configured');
      return null;
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    
    const { data: { user }, error } = await supabase.auth.admin.getUserById(userId);
    
    if (error || !user?.email) {
      console.warn(`[Email] Could not get email for user ${userId}:`, error?.message);
      return null;
    }
    
    return user.email;
  } catch (error: any) {
    console.error(`[Email] Error fetching email for user ${userId}:`, error?.message);
    return null;
  }
}

// Helper function to format timestamp for display (matches telegram bid format)
function formatTimestamp(timestamp: Date | string | null | undefined): string | undefined {
  if (!timestamp) return undefined;
  try {
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    if (isNaN(date.getTime())) return undefined;
    
    // Use the same format as formatPickupDateTime from lib/format.ts
    const formatter = new Intl.DateTimeFormat('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
    
    const parts = formatter.formatToParts(date);
    const month = parts.find(part => part.type === 'month')?.value;
    const day = parts.find(part => part.type === 'day')?.value;
    const year = parts.find(part => part.type === 'year')?.value;
    const hour = parts.find(part => part.type === 'hour')?.value;
    const minute = parts.find(part => part.type === 'minute')?.value;
    const dayPeriod = parts.find(part => part.type === 'dayPeriod')?.value;
    
    return `${month}/${day}/${year} ${hour}:${minute} ${dayPeriod}`;
  } catch {
    return undefined;
  }
}

// Helper function to parse stops and extract origin/destination
function parseStops(stops: any): string[] {
  if (!stops) return [];
  if (Array.isArray(stops)) return stops;
  if (typeof stops === 'string') {
    try {
      const parsed = JSON.parse(stops);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return [stops];
    }
  }
  return [];
}

// Helper function to count stops
function countStops(stops: any): number | undefined {
  if (!stops) return undefined;
  if (Array.isArray(stops)) {
    return stops.length;
  }
  if (typeof stops === 'string') {
    try {
      const parsed = JSON.parse(stops);
      return Array.isArray(parsed) ? parsed.length : 1;
    } catch {
      return 1; // Single stop as string
    }
  }
  return 1; // Single stop as object
}

// Helper function to get load details from bid_number
async function getLoadDetails(bidNumber: string): Promise<{
  origin: string;
  destination: string;
  miles?: number;
  stops?: number;
  pickupTime?: string;
  deliveryTime?: string;
} | null> {
  try {
    // Try telegram_bids first (most common)
    const bidInfo = await sql`
      SELECT 
        pickup_timestamp,
        delivery_timestamp,
        distance_miles,
        stops,
        tag
      FROM telegram_bids
      WHERE bid_number = ${bidNumber}
      LIMIT 1
    `;
    
    if (bidInfo.length > 0) {
      const bid = bidInfo[0];
      
      // Extract origin and destination from stops array (like telegram bids)
      const stopsArray = parseStops(bid.stops);
      let origin = 'Origin';
      let destination = 'Destination';
      
      if (stopsArray.length > 0) {
        origin = stopsArray[0];
        destination = stopsArray[stopsArray.length - 1];
      } else if (bid.tag) {
        // Fallback to tag if no stops
        const parts = bid.tag.split('-');
        if (parts.length >= 2) {
          origin = parts[0].trim();
          destination = parts[1].trim();
        } else {
          origin = bid.tag;
        }
      }
      
      return {
        origin,
        destination,
        miles: bid.distance_miles ? parseFloat(bid.distance_miles) : undefined,
        stops: countStops(bid.stops),
        pickupTime: formatTimestamp(bid.pickup_timestamp),
        deliveryTime: formatTimestamp(bid.delivery_timestamp),
      };
    }
    
    // Fallback to loads table if available
    const loadInfo = await sql`
      SELECT 
        origin_city,
        origin_state,
        destination_city,
        destination_state,
        revenue,
        total_miles,
        pickup_date,
        pickup_time,
        delivery_date,
        delivery_time,
        nbr_of_stops
      FROM loads
      WHERE rr_number = ${bidNumber} OR tm_number = ${bidNumber}
      LIMIT 1
    `;
    
    if (loadInfo.length > 0) {
      const load = loadInfo[0];
      
      // Format pickup time
      let pickupTime: string | undefined = undefined;
      if (load.pickup_date) {
        const pickupDate = new Date(load.pickup_date);
        if (load.pickup_time) {
          const [hours, minutes] = load.pickup_time.split(':');
          if (hours && minutes) {
            pickupDate.setHours(parseInt(hours), parseInt(minutes));
          }
        }
        pickupTime = formatTimestamp(pickupDate);
      }
      
      // Format delivery time
      let deliveryTime: string | undefined = undefined;
      if (load.delivery_date) {
        const deliveryDate = new Date(load.delivery_date);
        if (load.delivery_time) {
          const [hours, minutes] = load.delivery_time.split(':');
          if (hours && minutes) {
            deliveryDate.setHours(parseInt(hours), parseInt(minutes));
          }
        }
        deliveryTime = formatTimestamp(deliveryDate);
      }
      
      return {
        origin: `${load.origin_city || ''}, ${load.origin_state || ''}`.trim() || 'Origin',
        destination: `${load.destination_city || ''}, ${load.destination_state || ''}`.trim() || 'Destination',
        miles: load.total_miles || undefined,
        stops: load.nbr_of_stops || undefined,
        pickupTime,
        deliveryTime,
      };
    }
    
    return null;
  } catch (error: any) {
    console.error(`[Email] Error fetching load details for ${bidNumber}:`, error?.message);
    return null;
  }
}

// Helper function to get carrier name
async function getCarrierName(userId: string): Promise<string | null> {
  try {
    const profile = await sql`
      SELECT legal_name, company_name
      FROM carrier_profiles
      WHERE supabase_user_id = ${userId}
      LIMIT 1
    `;
    
    if (profile.length > 0) {
      return profile[0].legal_name || profile[0].company_name || null;
    }
    
    return null;
  } catch (error: any) {
    console.error(`[Email] Error fetching carrier name for ${userId}:`, error?.message);
    return null;
  }
}

// Process a notification job
async function processNotificationJob(job: Job): Promise<void> {
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
  // Don't return the count - worker expects void
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
        
        // Get load details for email
        const loadDetails = await getLoadDetails(load.bid_number);
        
        await sendNotification({
          carrierUserId: userId,
          triggerId: trigger.id,
          notificationType: 'similar_load',
          bidNumber: load.bid_number,
          message,
          loadDetails: loadDetails || undefined,
          matchScore: shouldTrigger.matchScore || load.similarity_score,
          reasons: shouldTrigger.reason ? [shouldTrigger.reason] : [],
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

// Helper function to send notifications (in-app + email)
async function sendNotification({
  carrierUserId,
  triggerId,
  notificationType,
  bidNumber,
  message,
  loadDetails,
  matchScore,
  reasons,
  minutesRemaining,
}: {
  carrierUserId: string;
  triggerId: number;
  notificationType: string;
  bidNumber: string;
  message: string;
  loadDetails?: { 
    origin: string; 
    destination: string; 
    miles?: number;
    stops?: number;
    pickupTime?: string;
    deliveryTime?: string;
  };
  matchScore?: number;
  reasons?: string[];
  minutesRemaining?: number;
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

    // Send email notification (if enabled)
    try {
      // Check if email notifications are enabled
      const prefsResult = await sql`
        SELECT email_notifications
        FROM carrier_notification_preferences
        WHERE supabase_carrier_user_id = ${carrierUserId}
        LIMIT 1
      `;
      
      const emailEnabled = prefsResult[0]?.email_notifications ?? true; // Default to true
      
      if (!emailEnabled) {
        console.log(`[Email] Email notifications disabled for user ${carrierUserId}`);
        return;
      }

      // Get carrier email
      const carrierEmail = await getCarrierEmail(carrierUserId);
      if (!carrierEmail) {
        console.warn(`[Email] No email found for user ${carrierUserId}, skipping email`);
        return;
      }

      // Get load details if not provided
      const loadInfo = loadDetails || await getLoadDetails(bidNumber);
      if (!loadInfo) {
        console.warn(`[Email] Could not get load details for ${bidNumber}, skipping email`);
        return;
      }

      // Get carrier name
      const carrierName = await getCarrierName(carrierUserId);

      // Build view URL
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || 'https://novafreight.io';
      const viewUrl = `${baseUrl}/find-loads?bid=${bidNumber}`;

      // Send email based on notification type
      let emailResult;
      switch (notificationType) {
        case 'exact_match':
          emailResult = await sendEmail({
            to: carrierEmail,
            subject: `🎯 Exact Match Found: ${loadInfo.origin} → ${loadInfo.destination}`,
            react: ExactMatchNotificationTemplate({
              bidNumber,
              origin: loadInfo.origin,
              destination: loadInfo.destination,
              miles: loadInfo.miles,
              stops: loadInfo.stops,
              pickupTime: loadInfo.pickupTime,
              deliveryTime: loadInfo.deliveryTime,
              viewUrl,
              carrierName: carrierName || undefined,
            }),
          });
          break;

        case 'similar_load':
          emailResult = await sendEmail({
            to: carrierEmail,
            subject: `🚚 Similar Load Found: ${bidNumber} (${matchScore || 0}% match)`,
            react: SimilarLoadNotificationTemplate({
              bidNumber,
              origin: loadInfo.origin,
              destination: loadInfo.destination,
              matchScore: matchScore || 0,
              reasons: reasons || [],
              miles: loadInfo.miles,
              stops: loadInfo.stops,
              pickupTime: loadInfo.pickupTime,
              deliveryTime: loadInfo.deliveryTime,
              viewUrl,
              carrierName: carrierName || undefined,
            }),
          });
          break;

        case 'favorite_available':
          emailResult = await sendEmail({
            to: carrierEmail,
            subject: `⭐ Your Favorite Load is Available: ${bidNumber}`,
            react: FavoriteAvailableNotificationTemplate({
              bidNumber,
              origin: loadInfo.origin,
              destination: loadInfo.destination,
              miles: loadInfo.miles,
              stops: loadInfo.stops,
              pickupTime: loadInfo.pickupTime,
              deliveryTime: loadInfo.deliveryTime,
              viewUrl,
              carrierName: carrierName || undefined,
            }),
          });
          break;

        case 'deadline_approaching':
          if (minutesRemaining) {
            emailResult = await sendEmail({
              to: carrierEmail,
              subject: `⏰ Bid ${bidNumber} Closing in ${minutesRemaining} Minutes`,
              react: DeadlineApproachingNotificationTemplate({
                bidNumber,
                origin: loadInfo.origin,
                destination: loadInfo.destination,
                minutesRemaining,
                miles: loadInfo.miles,
                stops: loadInfo.stops,
                pickupTime: loadInfo.pickupTime,
                deliveryTime: loadInfo.deliveryTime,
                viewUrl,
                carrierName: carrierName || undefined,
              }),
            });
          }
          break;

        // Note: bid_won and bid_lost are typically sent from auction functions, not here
        // But we can add them if needed
      }

      if (emailResult?.success) {
        console.log(`✅ Email sent to ${carrierEmail} for ${notificationType} notification`);
      } else {
        console.warn(`⚠️  Email failed for ${carrierEmail}:`, emailResult?.error);
      }
    } catch (emailError: any) {
      // Don't fail the notification if email fails
      console.error(`[Email] Error sending email notification:`, emailError?.message);
    }
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

