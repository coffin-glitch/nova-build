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
async function processExactMatchNotifications(): Promise<number> {
  try {
    const triggers = await sql`
      SELECT 
        nt.id,
        nt.supabase_carrier_user_id,
        nt.trigger_config
      FROM notification_triggers nt
      WHERE nt.trigger_type = 'exact_match'
      AND nt.is_active = true
    `;

    let processedCount = 0;

    // Helper function to extract state from stop string (same as heat map)
    const extractState = (stop: string): string | null => {
      if (!stop) return null;
      const trimmed = stop.trim().toUpperCase();
      const validStates = new Set([
        'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
        'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
        'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
        'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
        'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'
      ]);
      let match = trimmed.match(/,\s*([A-Z]{2})$/);
      if (match && validStates.has(match[1])) return match[1];
      match = trimmed.match(/\s+([A-Z]{2})$/);
      if (match && validStates.has(match[1])) return match[1];
      match = trimmed.match(/,\s*([A-Z]{2})\s*,/);
      if (match && validStates.has(match[1])) return match[1];
      match = trimmed.match(/([A-Z]{2})$/);
      if (match && validStates.has(match[1])) return match[1];
      return null;
    };

    for (const trigger of triggers) {
      // Parse trigger_config if it's a string
      let config = trigger.trigger_config;
      if (typeof config === 'string') {
        try {
          config = JSON.parse(config);
        } catch (e) {
          console.error('Error parsing trigger_config:', e);
          config = {};
        }
      }
      
      const favoriteBidNumbers = config.favoriteBidNumbers || [];
      const matchType = config.matchType || 'exact'; // 'exact' or 'state'
      const backhaulEnabled = config.backhaulEnabled || false; // Per-trigger backhaul toggle

      for (const bidNumber of favoriteBidNumbers) {
        if (matchType === 'exact') {
          // Exact match: Check if this exact bid is available again
          const exactMatch = await sql`
            SELECT * FROM telegram_bids
            WHERE bid_number = ${bidNumber}
            AND is_archived = false
            AND NOW() <= (received_at::timestamp + INTERVAL '25 minutes')
            LIMIT 1
          `;

          if (exactMatch.length > 0) {
            // Get user preferences to check max competition bids
            const preferencesResult = await sql`
              SELECT avoid_high_competition, max_competition_bids
              FROM carrier_notification_preferences
              WHERE supabase_carrier_user_id = ${trigger.supabase_carrier_user_id}
              LIMIT 1
            `;
            
            const preferences = preferencesResult[0];
            
            // Check bid count if avoidHighCompetition is enabled
            if (preferences?.avoid_high_competition) {
              const bidCountResult = await sql`
                SELECT COUNT(*)::integer as bid_count
                FROM carrier_bids
                WHERE bid_number = ${bidNumber}
              `;
              const bidCount = bidCountResult[0]?.bid_count || 0;
              if (bidCount > (preferences.max_competition_bids || 10)) {
                continue; // Skip this bid - too much competition
              }
            }
            
            // Check notification history for this bid
            const notificationHistory = await sql`
              SELECT id, sent_at
              FROM notification_logs
              WHERE supabase_carrier_user_id = ${trigger.supabase_carrier_user_id}
              AND bid_number = ${bidNumber}
              AND notification_type = 'exact_match'
              ORDER BY sent_at DESC
            `;
            
            // Calculate time since bid was received
            const bidReceivedAt = new Date(exactMatch[0].received_at);
            const now = new Date();
            const minutesSinceReceived = Math.floor((now.getTime() - bidReceivedAt.getTime()) / (1000 * 60));
            const minutesRemaining = 25 - minutesSinceReceived;
            
            // Only notify if bid is still active (within 25 minutes)
            if (minutesRemaining <= 0) {
              continue; // Bid has expired, skip notification
            }
            
            // Check if we should send a notification (every 8 minutes)
            const shouldNotify = notificationHistory.length === 0 || 
              (notificationHistory.length > 0 && 
               new Date(notificationHistory[0].sent_at).getTime() < now.getTime() - (8 * 60 * 1000));
            
            if (shouldNotify) {
              // Determine message based on notification count
              let message = '';
              const notificationCount = notificationHistory.length + 1;
              
              if (notificationCount === 3) {
                // 3rd notification - final warning
                message = `Final notification for matching bid ${bidNumber}: 1 minute left till bid is closed.`;
              } else {
                message = `Exact match available! Your favorited load ${bidNumber} is back on the board.`;
              }
              
              await sendNotification({
                carrierUserId: trigger.supabase_carrier_user_id,
                triggerId: trigger.id,
                notificationType: 'exact_match',
                bidNumber: bidNumber,
                message: message
              });
              processedCount++;
            }
            
            // Check for backhaul opportunities if enabled for this trigger
            if (backhaulEnabled) {
              // Get the favorite bid to determine return route
              const favoriteBid = await sql`
                SELECT tb.stops
                FROM carrier_favorites cf
                JOIN telegram_bids tb ON cf.bid_number = tb.bid_number
                WHERE cf.supabase_carrier_user_id = ${trigger.supabase_carrier_user_id}
                  AND cf.bid_number = ${bidNumber}
                LIMIT 1
              `;
              
              if (favoriteBid.length > 0 && favoriteBid[0].stops) {
                let favoriteStops: string[] = [];
                if (Array.isArray(favoriteBid[0].stops)) {
                  favoriteStops = favoriteBid[0].stops;
                } else if (typeof favoriteBid[0].stops === 'string') {
                  try {
                    const parsed = JSON.parse(favoriteBid[0].stops);
                    favoriteStops = Array.isArray(parsed) ? parsed : [parsed];
                  } catch {
                    favoriteStops = [favoriteBid[0].stops];
                  }
                }
                
                if (favoriteStops.length >= 2) {
                  const favoriteOriginState = extractState(favoriteStops[0]);
                  const favoriteDestState = extractState(favoriteStops[favoriteStops.length - 1]);
                  
                  // Look for backhaul: destination -> origin (reverse route)
                  if (favoriteOriginState && favoriteDestState) {
                    const backhaulMatches = await sql`
                      SELECT tb.bid_number, tb.stops
                      FROM telegram_bids tb
                      WHERE tb.is_archived = false
                      AND NOW() <= (tb.received_at::timestamp + INTERVAL '25 minutes')
                      AND tb.bid_number != ${bidNumber}
                      AND tb.stops IS NOT NULL
                    `;
                    
                    for (const backhaul of backhaulMatches) {
                      let backhaulStops: string[] = [];
                      if (backhaul.stops) {
                        if (Array.isArray(backhaul.stops)) {
                          backhaulStops = backhaul.stops;
                        } else if (typeof backhaul.stops === 'string') {
                          try {
                            const parsed = JSON.parse(backhaul.stops);
                            backhaulStops = Array.isArray(parsed) ? parsed : [parsed];
                          } catch {
                            backhaulStops = [backhaul.stops];
                          }
                        }
                      }
                      
                      if (backhaulStops.length < 2) continue;
                      
                      const backhaulOriginState = extractState(backhaulStops[0]);
                      const backhaulDestState = extractState(backhaulStops[backhaulStops.length - 1]);
                      
                      // Check if this is an exact backhaul (destination -> origin with same cities)
                      const favoriteOriginCity = favoriteStops[0].toUpperCase();
                      const favoriteDestCity = favoriteStops[favoriteStops.length - 1].toUpperCase();
                      const backhaulOriginCity = backhaulStops[0].toUpperCase();
                      const backhaulDestCity = backhaulStops[backhaulStops.length - 1].toUpperCase();
                      
                      if (backhaulOriginState === favoriteDestState && backhaulDestState === favoriteOriginState &&
                          backhaulOriginCity === favoriteDestCity && backhaulDestCity === favoriteOriginCity) {
                        // Check if backhaul bid is still active (within 25 minutes)
                        const backhaulBid = await sql`
                          SELECT received_at
                          FROM telegram_bids
                          WHERE bid_number = ${backhaul.bid_number}
                          LIMIT 1
                        `;
                        
                        if (backhaulBid.length === 0) continue;
                        
                        const backhaulReceivedAt = new Date(backhaulBid[0].received_at);
                        const now = new Date();
                        const minutesSinceReceived = Math.floor((now.getTime() - backhaulReceivedAt.getTime()) / (1000 * 60));
                        const minutesRemaining = 25 - minutesSinceReceived;
                        
                        // Only notify if bid is still active (within 25 minutes)
                        if (minutesRemaining <= 0) {
                          continue; // Bid has expired, skip notification
                        }
                        
                        // Check notification history for this backhaul
                        const backhaulNotificationHistory = await sql`
                          SELECT id, sent_at
                          FROM notification_logs
                          WHERE supabase_carrier_user_id = ${trigger.supabase_carrier_user_id}
                          AND bid_number = ${backhaul.bid_number}
                          AND notification_type = 'exact_match'
                          ORDER BY sent_at DESC
                        `;
                        
                        // Check if we should send a notification (every 8 minutes)
                        const shouldNotifyBackhaul = backhaulNotificationHistory.length === 0 || 
                          (backhaulNotificationHistory.length > 0 && 
                           new Date(backhaulNotificationHistory[0].sent_at).getTime() < now.getTime() - (8 * 60 * 1000));
                        
                        if (shouldNotifyBackhaul) {
                          // Determine message based on notification count
                          let message = '';
                          const notificationCount = backhaulNotificationHistory.length + 1;
                          
                          if (notificationCount === 3) {
                            // 3rd notification - final warning
                            message = `Final notification for matching bid ${backhaul.bid_number}: 1 minute left till bid is closed.`;
                          } else {
                            message = `Backhaul opportunity! Exact return route for your favorited load ${bidNumber}: ${backhaul.bid_number}`;
                          }
                          
                          await sendNotification({
                            carrierUserId: trigger.supabase_carrier_user_id,
                            triggerId: trigger.id,
                            notificationType: 'exact_match',
                            bidNumber: backhaul.bid_number,
                            message: message
                          });
                          processedCount++;
                          break; // Only send one backhaul notification per trigger check
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        } else if (matchType === 'state') {
          // State match: Check if any load with same state-to-state route appears
          const originState = config.originState;
          const destinationState = config.destinationState;
          
          if (!originState || !destinationState) continue;

          // Get the favorite bid to compare
          const favoriteBid = await sql`
            SELECT stops FROM carrier_favorites cf
            JOIN telegram_bids tb ON cf.bid_number = tb.bid_number
            WHERE cf.bid_number = ${bidNumber}
            LIMIT 1
          `;

          if (favoriteBid.length === 0) continue;

          // Find all active bids with matching state-to-state route
          const stateMatches = await sql`
            SELECT tb.bid_number, tb.stops
            FROM telegram_bids tb
            WHERE tb.is_archived = false
            AND NOW() <= (tb.received_at::timestamp + INTERVAL '25 minutes')
            AND tb.bid_number != ${bidNumber}
            AND tb.stops IS NOT NULL
          `;

          for (const match of stateMatches) {
            let stops: string[] = [];
            if (match.stops) {
              if (Array.isArray(match.stops)) {
                stops = match.stops;
              } else if (typeof match.stops === 'string') {
                try {
                  const parsed = JSON.parse(match.stops);
                  stops = Array.isArray(parsed) ? parsed : [parsed];
                } catch {
                  stops = [match.stops];
                }
              }
            }

            if (stops.length < 2) continue;

            const matchOriginState = extractState(stops[0]);
            const matchDestState = extractState(stops[stops.length - 1]);

            // Check if state-to-state matches
            if (matchOriginState === originState && matchDestState === destinationState) {
              // Get user preferences to check max competition bids
              const preferencesResult = await sql`
                SELECT avoid_high_competition, max_competition_bids, prioritize_backhaul
                FROM carrier_notification_preferences
                WHERE supabase_carrier_user_id = ${trigger.supabase_carrier_user_id}
                LIMIT 1
              `;
              
              const preferences = preferencesResult[0];
              
              // Check bid count if avoidHighCompetition is enabled
              if (preferences?.avoid_high_competition) {
                const bidCountResult = await sql`
                  SELECT COUNT(*)::integer as bid_count
                  FROM carrier_bids
                  WHERE bid_number = ${match.bid_number}
                `;
                const bidCount = bidCountResult[0]?.bid_count || 0;
                if (bidCount > (preferences.max_competition_bids || 10)) {
                  continue; // Skip this bid - too much competition
                }
              }
              
              // Check if bid is still active (within 25 minutes)
              const matchBid = await sql`
                SELECT received_at
                FROM telegram_bids
                WHERE bid_number = ${match.bid_number}
                LIMIT 1
              `;
              
              if (matchBid.length === 0) continue;
              
              const bidReceivedAt = new Date(matchBid[0].received_at);
              const now = new Date();
              const minutesSinceReceived = Math.floor((now.getTime() - bidReceivedAt.getTime()) / (1000 * 60));
              const minutesRemaining = 25 - minutesSinceReceived;
              
              // Only notify if bid is still active (within 25 minutes)
              if (minutesRemaining <= 0) {
                continue; // Bid has expired, skip notification
              }
              
              // Check notification history for this bid
              const notificationHistory = await sql`
                SELECT id, sent_at
                FROM notification_logs
                WHERE supabase_carrier_user_id = ${trigger.supabase_carrier_user_id}
                AND bid_number = ${match.bid_number}
                AND notification_type = 'exact_match'
                ORDER BY sent_at DESC
              `;
              
              // Check if we should send a notification (every 8 minutes)
              const shouldNotify = notificationHistory.length === 0 || 
                (notificationHistory.length > 0 && 
                 new Date(notificationHistory[0].sent_at).getTime() < now.getTime() - (8 * 60 * 1000));
              
              if (shouldNotify) {
                // Determine message based on notification count
                let message = '';
                const notificationCount = notificationHistory.length + 1;
                
                if (notificationCount === 3) {
                  // 3rd notification - final warning
                  message = `Final notification for matching bid ${match.bid_number}: 1 minute left till bid is closed.`;
                } else {
                  message = `State match available! A load matching your favorited route (${originState} → ${destinationState}) is on the board: ${match.bid_number}`;
                }
                
                await sendNotification({
                  carrierUserId: trigger.supabase_carrier_user_id,
                  triggerId: trigger.id,
                  notificationType: 'exact_match',
                  bidNumber: match.bid_number,
                  message: message
                });
                processedCount++;
                break; // Only send one notification per trigger check
              }
            }
          }
          
          // Check for backhaul opportunities if enabled for this trigger
          if (backhaulEnabled) {
            // Look for backhaul: destination -> origin (reverse state route)
            const backhaulMatches = await sql`
              SELECT tb.bid_number, tb.stops
              FROM telegram_bids tb
              WHERE tb.is_archived = false
              AND NOW() <= (tb.received_at::timestamp + INTERVAL '25 minutes')
              AND tb.bid_number != ${bidNumber}
              AND tb.stops IS NOT NULL
            `;
            
            for (const backhaul of backhaulMatches) {
              let backhaulStops: string[] = [];
              if (backhaul.stops) {
                if (Array.isArray(backhaul.stops)) {
                  backhaulStops = backhaul.stops;
                } else if (typeof backhaul.stops === 'string') {
                  try {
                    const parsed = JSON.parse(backhaul.stops);
                    backhaulStops = Array.isArray(parsed) ? parsed : [parsed];
                  } catch {
                    backhaulStops = [backhaul.stops];
                  }
                }
              }
              
              if (backhaulStops.length < 2) continue;
              
              const backhaulOriginState = extractState(backhaulStops[0]);
              const backhaulDestState = extractState(backhaulStops[backhaulStops.length - 1]);
              
              // Check if this is a backhaul (destination -> origin state route)
              if (backhaulOriginState === destinationState && backhaulDestState === originState) {
                // Check if backhaul bid is still active (within 25 minutes)
                const backhaulBid = await sql`
                  SELECT received_at
                  FROM telegram_bids
                  WHERE bid_number = ${backhaul.bid_number}
                  LIMIT 1
                `;
                
                if (backhaulBid.length === 0) continue;
                
                const backhaulReceivedAt = new Date(backhaulBid[0].received_at);
                const now = new Date();
                const minutesSinceReceived = Math.floor((now.getTime() - backhaulReceivedAt.getTime()) / (1000 * 60));
                const minutesRemaining = 25 - minutesSinceReceived;
                
                // Only notify if bid is still active (within 25 minutes)
                if (minutesRemaining <= 0) {
                  continue; // Bid has expired, skip notification
                }
                
                // Check notification history for this backhaul
                const backhaulNotificationHistory = await sql`
                  SELECT id, sent_at
                  FROM notification_logs
                  WHERE supabase_carrier_user_id = ${trigger.supabase_carrier_user_id}
                  AND bid_number = ${backhaul.bid_number}
                  AND notification_type = 'exact_match'
                  ORDER BY sent_at DESC
                `;
                
                // Check if we should send a notification (every 8 minutes)
                const shouldNotifyBackhaul = backhaulNotificationHistory.length === 0 || 
                  (backhaulNotificationHistory.length > 0 && 
                   new Date(backhaulNotificationHistory[0].sent_at).getTime() < now.getTime() - (8 * 60 * 1000));
                
                if (shouldNotifyBackhaul) {
                  // Determine message based on notification count
                  let message = '';
                  const notificationCount = backhaulNotificationHistory.length + 1;
                  
                  if (notificationCount === 3) {
                    // 3rd notification - final warning
                    message = `Final notification for matching bid ${backhaul.bid_number}: 1 minute left till bid is closed.`;
                  } else {
                    message = `Backhaul opportunity! Return route (${backhaulOriginState} → ${backhaulDestState}) for your state match alert: ${backhaul.bid_number}`;
                  }
                  
                  await sendNotification({
                    carrierUserId: trigger.supabase_carrier_user_id,
                    triggerId: trigger.id,
                    notificationType: 'exact_match',
                    bidNumber: backhaul.bid_number,
                    message: message
                  });
                  processedCount++;
                  break; // Only send one backhaul notification per trigger check
                }
              }
            }
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
          WHERE supabase_carrier_user_id = ${trigger.supabase_carrier_user_id}
          AND bid_number = ${load.bid_number}
          AND notification_type = 'new_route'
          AND sent_at > NOW() - INTERVAL '30 minutes'
          LIMIT 1
        `;

        if (existingNotification.length === 0) {
          await sendNotification({
            carrierUserId: trigger.supabase_carrier_user_id,
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
            WHERE supabase_carrier_user_id = ${trigger.supabase_carrier_user_id}
            AND bid_number = ${bidNumber}
            AND notification_type = 'favorite_available'
            AND sent_at > NOW() - INTERVAL '1 hour'
            LIMIT 1
          `;

          if (existingNotification.length === 0) {
            await sendNotification({
              carrierUserId: trigger.supabase_carrier_user_id,
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
          WHERE supabase_carrier_user_id = ${trigger.supabase_carrier_user_id}
          AND bid_number = ${load.bid_number}
          AND notification_type = 'deadline_approaching'
          AND sent_at > NOW() - INTERVAL '30 minutes'
          LIMIT 1
        `;

        if (existingNotification.length === 0) {
          const timeLeft = Math.round((new Date(load.expires_at).getTime() - Date.now()) / (1000 * 60));
          await sendNotification({
            carrierUserId: trigger.supabase_carrier_user_id,
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
