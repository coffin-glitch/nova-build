import { shouldTriggerNotification, type AdvancedNotificationPreferences } from '@/lib/advanced-notification-preferences';
import sql from '@/lib/db';
import { NextRequest, NextResponse } from "next/server";

// This service processes notification triggers and sends notifications
export async function POST(request: NextRequest) {
  try {
    console.log("Starting notification processing...");
    
    // Process different types of notifications
    const results = {
      similarLoads: await processSimilarLoadNotifications(),
      exactMatches: await processExactMatchNotifications(),
      priceDrops: await processPriceDropNotifications(),
      newRoutes: await processNewRouteNotifications(),
      favoriteAvailable: await processFavoriteAvailableNotifications(),
      deadlineApproaching: await processDeadlineApproachingNotifications()
    };

    const totalProcessed = Object.values(results).reduce((sum, count) => sum + count, 0);

    console.log(`Notification processing completed. Processed ${totalProcessed} notifications.`);

    return NextResponse.json({
      ok: true,
      message: `Processed ${totalProcessed} notifications`,
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

// Process similar load notifications
async function processSimilarLoadNotifications(): Promise<number> {
  try {
    // Get active similar load triggers
    const triggers = await sql`
      SELECT 
        nt.id,
        nt.carrier_user_id,
        nt.trigger_config,
        cf.bid_number as favorite_bid_number
      FROM notification_triggers nt
      JOIN carrier_favorites cf ON nt.carrier_user_id = cf.carrier_user_id
      WHERE nt.trigger_type = 'similar_load'
      AND nt.is_active = true
    `;

    let processedCount = 0;

    for (const trigger of triggers) {
      const config = trigger.trigger_config as any;
      const distanceThreshold = config.distanceThreshold || 50;

      // Find similar loads using the database function
      const similarLoads = await sql`
        SELECT * FROM find_similar_loads(
          ${trigger.carrier_user_id},
          ${distanceThreshold},
          ${config.statePreferences || null}
        )
        WHERE similarity_score >= 70
        LIMIT 5
      `;

      for (const load of similarLoads) {
        // Check if we already sent a notification for this load
        const existingNotification = await sql`
          SELECT id FROM notification_logs
          WHERE carrier_user_id = ${trigger.carrier_user_id}
          AND bid_number = ${load.bid_number}
          AND notification_type = 'similar_load'
          AND sent_at > NOW() - INTERVAL '1 hour'
          LIMIT 1
        `;

        if (existingNotification.length > 0) continue;

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
            alert_on_price_drops,
            alert_on_new_routes,
            market_baseline_price
          FROM carrier_notification_preferences
          WHERE carrier_user_id = ${trigger.carrier_user_id}
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
          WHERE cf.carrier_user_id = ${trigger.carrier_user_id}
        `;

        // Check if should trigger based on advanced preferences
        const shouldTrigger = shouldTriggerNotification(
          load,
          preferences as AdvancedNotificationPreferences,
          favorites
        );

        if (shouldTrigger.shouldNotify) {
          // Send notification with match details
          await sendNotification({
            carrierUserId: trigger.carrier_user_id,
            triggerId: trigger.id,
            notificationType: 'similar_load',
            bidNumber: load.bid_number,
            message: `High-match load found! ${load.bid_number} - ${load.distance_miles}mi, ${load.tag}. Match: ${shouldTrigger.matchScore || load.similarity_score}%. ${shouldTrigger.reason}`
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
async function processExactMatchNotifications(): Promise<number> {
  try {
    const triggers = await sql`
      SELECT 
        nt.id,
        nt.carrier_user_id,
        nt.trigger_config
      FROM notification_triggers nt
      WHERE nt.trigger_type = 'exact_match'
      AND nt.is_active = true
    `;

    let processedCount = 0;

    for (const trigger of triggers) {
      const config = trigger.trigger_config as any;
      const favoriteBidNumbers = config.favoriteBidNumbers || [];

      for (const bidNumber of favoriteBidNumbers) {
        // Check if this exact bid is available again
        const exactMatch = await sql`
          SELECT * FROM telegram_bids
          WHERE bid_number = ${bidNumber}
          AND is_archived = false
          AND NOW() <= (received_at::timestamp + INTERVAL '25 minutes')
          LIMIT 1
        `;

        if (exactMatch.length > 0) {
          // Check if we already sent a notification
          const existingNotification = await sql`
            SELECT id FROM notification_logs
            WHERE carrier_user_id = ${trigger.carrier_user_id}
            AND bid_number = ${bidNumber}
            AND notification_type = 'exact_match'
            AND sent_at > NOW() - INTERVAL '2 hours'
            LIMIT 1
          `;

          if (existingNotification.length === 0) {
            await sendNotification({
              carrierUserId: trigger.carrier_user_id,
              triggerId: trigger.id,
              notificationType: 'exact_match',
              bidNumber: bidNumber,
              message: `Exact match available! Your favorited load ${bidNumber} is back on the board.`
            });
            processedCount++;
          }
        }
      }
    }

    return processedCount;
  } catch (error) {
    console.error("Error processing exact match notifications:", error);
    return 0;
  }
}

// Process price drop notifications
async function processPriceDropNotifications(): Promise<number> {
  try {
    const triggers = await sql`
      SELECT 
        nt.id,
        nt.carrier_user_id,
        nt.trigger_config
      FROM notification_triggers nt
      WHERE nt.trigger_type = 'price_drop'
      AND nt.is_active = true
    `;

    let processedCount = 0;

    for (const trigger of triggers) {
      const config = trigger.trigger_config as any;
      const priceThreshold = config.priceThreshold || 100;

      // Find loads with low prices
      const lowPriceLoads = await sql`
        SELECT 
          tb.bid_number,
          tb.distance_miles,
          tb.tag,
          COALESCE(lowest_bid.amount_cents / 100.0, 0) as current_bid
        FROM telegram_bids tb
        LEFT JOIN (
          SELECT 
            cb1.bid_number,
            cb1.amount_cents
          FROM carrier_bids cb1
          WHERE cb1.id = (
            SELECT cb2.id 
            FROM carrier_bids cb2 
            WHERE cb2.bid_number = cb1.bid_number 
            ORDER BY cb2.amount_cents ASC
            LIMIT 1
          )
        ) lowest_bid ON tb.bid_number = lowest_bid.bid_number
        WHERE tb.is_archived = false
        AND NOW() <= (tb.received_at::timestamp + INTERVAL '25 minutes')
        AND COALESCE(lowest_bid.amount_cents / 100.0, 0) <= ${priceThreshold}
        ORDER BY current_bid ASC
        LIMIT 10
      `;

      for (const load of lowPriceLoads) {
        const existingNotification = await sql`
          SELECT id FROM notification_logs
          WHERE carrier_user_id = ${trigger.carrier_user_id}
          AND bid_number = ${load.bid_number}
          AND notification_type = 'price_drop'
          AND sent_at > NOW() - INTERVAL '1 hour'
          LIMIT 1
        `;

        if (existingNotification.length === 0) {
          await sendNotification({
            carrierUserId: trigger.carrier_user_id,
            triggerId: trigger.id,
            notificationType: 'price_drop',
            bidNumber: load.bid_number,
            message: `Price drop alert! Load ${load.bid_number} - ${load.distance_miles} miles, ${load.tag} state. Current bid: $${load.current_bid.toFixed(2)}`
          });
          processedCount++;
        }
      }
    }

    return processedCount;
  } catch (error) {
    console.error("Error processing price drop notifications:", error);
    return 0;
  }
}

// Process new route notifications
async function processNewRouteNotifications(): Promise<number> {
  try {
    const triggers = await sql`
      SELECT 
        nt.id,
        nt.carrier_user_id,
        nt.trigger_config
      FROM notification_triggers nt
      WHERE nt.trigger_type = 'new_route'
      AND nt.is_active = true
    `;

    let processedCount = 0;

    for (const trigger of triggers) {
      const config = trigger.trigger_config as any;
      const statePreferences = config.statePreferences || [];

      if (statePreferences.length === 0) continue;

      // Find new loads in preferred states
      const newLoads = await sql`
        SELECT 
          tb.bid_number,
          tb.distance_miles,
          tb.tag,
          tb.received_at
        FROM telegram_bids tb
        WHERE tb.is_archived = false
        AND NOW() <= (tb.received_at::timestamp + INTERVAL '25 minutes')
        AND tb.tag = ANY(${statePreferences})
        AND tb.received_at > NOW() - INTERVAL '1 hour'
        ORDER BY tb.received_at DESC
        LIMIT 5
      `;

      for (const load of newLoads) {
        const existingNotification = await sql`
          SELECT id FROM notification_logs
          WHERE carrier_user_id = ${trigger.carrier_user_id}
          AND bid_number = ${load.bid_number}
          AND notification_type = 'new_route'
          AND sent_at > NOW() - INTERVAL '30 minutes'
          LIMIT 1
        `;

        if (existingNotification.length === 0) {
          await sendNotification({
            carrierUserId: trigger.carrier_user_id,
            triggerId: trigger.id,
            notificationType: 'new_route',
            bidNumber: load.bid_number,
            message: `New route in ${load.tag}! Load ${load.bid_number} - ${load.distance_miles} miles just posted.`
          });
          processedCount++;
        }
      }
    }

    return processedCount;
  } catch (error) {
    console.error("Error processing new route notifications:", error);
    return 0;
  }
}

// Process favorite available notifications
async function processFavoriteAvailableNotifications(): Promise<number> {
  try {
    const triggers = await sql`
      SELECT 
        nt.id,
        nt.carrier_user_id,
        nt.trigger_config
      FROM notification_triggers nt
      WHERE nt.trigger_type = 'favorite_available'
      AND nt.is_active = true
    `;

    let processedCount = 0;

    for (const trigger of triggers) {
      const config = trigger.trigger_config as any;
      const favoriteBidNumbers = config.favoriteBidNumbers || [];

      for (const bidNumber of favoriteBidNumbers) {
        // Check if this favorite is available
        const favoriteAvailable = await sql`
          SELECT 
            tb.bid_number,
            tb.distance_miles,
            tb.tag,
            tb.received_at
          FROM telegram_bids tb
          WHERE tb.bid_number = ${bidNumber}
          AND tb.is_archived = false
          AND NOW() <= (tb.received_at::timestamp + INTERVAL '25 minutes')
          LIMIT 1
        `;

        if (favoriteAvailable.length > 0) {
          const existingNotification = await sql`
            SELECT id FROM notification_logs
            WHERE carrier_user_id = ${trigger.carrier_user_id}
            AND bid_number = ${bidNumber}
            AND notification_type = 'favorite_available'
            AND sent_at > NOW() - INTERVAL '1 hour'
            LIMIT 1
          `;

          if (existingNotification.length === 0) {
            await sendNotification({
              carrierUserId: trigger.carrier_user_id,
              triggerId: trigger.id,
              notificationType: 'favorite_available',
              bidNumber: bidNumber,
              message: `Your favorite load ${bidNumber} is available! ${favoriteAvailable[0].distance_miles} miles, ${favoriteAvailable[0].tag} state.`
            });
            processedCount++;
          }
        }
      }
    }

    return processedCount;
  } catch (error) {
    console.error("Error processing favorite available notifications:", error);
    return 0;
  }
}

// Process deadline approaching notifications
async function processDeadlineApproachingNotifications(): Promise<number> {
  try {
    const triggers = await sql`
      SELECT 
        nt.id,
        nt.carrier_user_id,
        nt.trigger_config
      FROM notification_triggers nt
      WHERE nt.trigger_type = 'deadline_approaching'
      AND nt.is_active = true
    `;

    let processedCount = 0;

    for (const trigger of triggers) {
      const config = trigger.trigger_config as any;
      const timeThreshold = config.timeThreshold || 2; // hours

      // Find loads approaching deadline
      const approachingDeadline = await sql`
        SELECT 
          tb.bid_number,
          tb.distance_miles,
          tb.tag,
          tb.received_at,
          (tb.received_at::timestamp + INTERVAL '25 minutes') as expires_at
        FROM telegram_bids tb
        WHERE tb.is_archived = false
        AND NOW() <= (tb.received_at::timestamp + INTERVAL '25 minutes')
        AND NOW() >= (tb.received_at::timestamp + INTERVAL '25 minutes') - INTERVAL '${timeThreshold} hours'
        ORDER BY expires_at ASC
        LIMIT 10
      `;

      for (const load of approachingDeadline) {
        const existingNotification = await sql`
          SELECT id FROM notification_logs
          WHERE carrier_user_id = ${trigger.carrier_user_id}
          AND bid_number = ${load.bid_number}
          AND notification_type = 'deadline_approaching'
          AND sent_at > NOW() - INTERVAL '30 minutes'
          LIMIT 1
        `;

        if (existingNotification.length === 0) {
          const timeLeft = Math.round((new Date(load.expires_at).getTime() - Date.now()) / (1000 * 60));
          await sendNotification({
            carrierUserId: trigger.carrier_user_id,
            triggerId: trigger.id,
            notificationType: 'deadline_approaching',
            bidNumber: load.bid_number,
            message: `Deadline approaching! Load ${load.bid_number} - ${load.distance_miles} miles, ${load.tag} state. ${timeLeft} minutes left.`
          });
          processedCount++;
        }
      }
    }

    return processedCount;
  } catch (error) {
    console.error("Error processing deadline approaching notifications:", error);
    return 0;
  }
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
        carrier_user_id,
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
        carrier_user_id,
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
    case 'price_drop':
      return 'Price Drop Alert';
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
