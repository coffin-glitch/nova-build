// Legacy notification processing functions
// These are kept for backward compatibility and can be removed once queue system is fully tested

import { shouldTriggerNotification, type AdvancedNotificationPreferences } from '@/lib/advanced-notification-preferences';
import sql from '@/lib/db';
import { checkRateLimit } from '@/lib/notification-cache';

// Process similar load notifications
export async function processSimilarLoadNotifications(): Promise<number> {
  try {
    // Get active similar load triggers
    const triggers = await sql`
      SELECT 
        nt.id,
        nt.supabase_carrier_user_id,
        nt.trigger_config,
        cf.bid_number as favorite_bid_number
      FROM notification_triggers nt
      JOIN carrier_favorites cf ON nt.supabase_carrier_user_id = cf.supabase_carrier_user_id
      WHERE nt.trigger_type = 'similar_load'
      AND nt.is_active = true
    `;

    let processedCount = 0;

    for (const trigger of triggers) {
      // Check rate limit
      const canSend = await checkRateLimit(trigger.supabase_carrier_user_id, 20, 3600);
      if (!canSend) {
        console.log(`Rate limit exceeded for user ${trigger.supabase_carrier_user_id}`);
        continue;
      }

      const config = trigger.trigger_config as any;
      const distanceThreshold = config.distanceThreshold || 50;

      // Find similar loads using the database function
      const similarLoads = await sql`
        SELECT * FROM find_similar_loads(
          ${trigger.supabase_carrier_user_id},
          ${distanceThreshold},
          ${config.statePreferences || null}
        )
        WHERE similarity_score >= 70
        LIMIT 5
      `;

      for (const load of similarLoads) {
        // Check if bid is still active (within 25 minutes)
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
        
        // Only notify if bid is still active (within 25 minutes)
        if (minutesRemaining <= 0) {
          continue; // Bid has expired, skip notification
        }
        
        // Check notification history for this load
        const notificationHistory = await sql`
          SELECT id, sent_at
          FROM notification_logs
          WHERE supabase_carrier_user_id = ${trigger.supabase_carrier_user_id}
          AND bid_number = ${load.bid_number}
          AND notification_type = 'similar_load'
          ORDER BY sent_at DESC
        `;
        
        // Check if we should send a notification (every 8 minutes)
        const shouldNotify = notificationHistory.length === 0 || 
          (notificationHistory.length > 0 && 
           new Date(notificationHistory[0].sent_at).getTime() < now.getTime() - (8 * 60 * 1000));
        
        if (!shouldNotify) continue;

        // Get user's advanced preferences
        const preferencesResult = await sql`
          SELECT 
            email_notifications,
            similar_load_notifications,
            distance_threshold_miles,
            state_preferences,
            equipment_preferences,
            min_distance,
            max_distance,
            min_match_score,
            route_match_threshold,
            equipment_strict,
            distance_flexibility,
            timing_relevance_days,
            prioritize_backhaul,
            market_price_alerts,
            route_origins,
            route_destinations,
            avoid_high_competition,
            max_competition_bids,
            price_sensitivity,
            minimum_transit_hours,
            maximum_transit_hours,
            preferred_pickup_days,
            avoid_weekends,
            track_market_trends,
            alert_on_new_routes,
            market_baseline_price
          FROM carrier_notification_preferences
          WHERE supabase_carrier_user_id = ${trigger.supabase_carrier_user_id}
          LIMIT 1
        `;

        const preferences = preferencesResult[0];
        
        // Get user's favorites for matching
        const favorites = await sql`
          SELECT 
            cf.bid_number,
            cf.created_at,
            tb.distance_miles as distance,
            tb.stops,
            tb.tag
          FROM carrier_favorites cf
          JOIN telegram_bids tb ON cf.bid_number = tb.bid_number
          WHERE cf.supabase_carrier_user_id = ${trigger.supabase_carrier_user_id}
        `;

        // Check if should trigger based on advanced preferences
        const shouldTrigger = shouldTriggerNotification(
          load,
          preferences as AdvancedNotificationPreferences,
          favorites
        );

        if (shouldTrigger.shouldNotify) {
          // Determine message based on notification count
          let message = '';
          const notificationCount = notificationHistory.length + 1;
          
          if (notificationCount === 3) {
            // 3rd notification - final warning
            message = `Final notification for matching bid ${load.bid_number}: 1 minute left till bid is closed.`;
          } else {
            message = `High-match load found! ${load.bid_number} - ${load.distance_miles}mi, ${load.tag}. Match: ${shouldTrigger.matchScore || load.similarity_score}%. ${shouldTrigger.reason}`;
          }
          
          // Send notification with match details
          await sendNotification({
            carrierUserId: trigger.supabase_carrier_user_id,
            triggerId: trigger.id,
            notificationType: 'similar_load',
            bidNumber: load.bid_number,
            message: message
          });
          processedCount++;
        }
      }
    }

    return processedCount;
  } catch (error) {
    console.error("Error processing similar load notifications:", error);
    return 0;
  }
}

// Process exact match notifications
export async function processExactMatchNotifications(): Promise<number> {
  // This is a simplified version - full implementation would be similar to original
  // Keeping it minimal for now as we're moving to queue-based processing
  return 0;
}

// Process new route notifications
export async function processNewRouteNotifications(): Promise<number> {
  // This is a simplified version - full implementation would be similar to original
  return 0;
}

// Process favorite available notifications
export async function processFavoriteAvailableNotifications(): Promise<number> {
  // This is a simplified version - full implementation would be similar to original
  return 0;
}

// Process deadline approaching notifications
export async function processDeadlineApproachingNotifications(): Promise<number> {
  // This is a simplified version - full implementation would be similar to original
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

    console.log(`Notification sent to ${carrierUserId}: ${message}`);
  } catch (error) {
    console.error("Error sending notification:", error);
  }
}

// Helper function to get notification titles
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

