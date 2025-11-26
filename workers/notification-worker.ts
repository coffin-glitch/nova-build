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
import { createClient } from '@supabase/supabase-js';
import { Job } from 'bullmq';
import 'dotenv/config';
import { shouldTriggerNotification, type AdvancedNotificationPreferences } from '../lib/advanced-notification-preferences';
import sql from '../lib/db';
import {
  BackhaulNotificationTemplate,
  DeadlineApproachingNotificationTemplate,
  ExactMatchNotificationTemplate,
  FavoriteAvailableNotificationTemplate,
  SimilarLoadNotificationTemplate
} from '../lib/email-templates/notification-templates';
import { sendEmail } from '../lib/email/notify';
import {
  checkRateLimit,
  getCachedFavorites,
  getCachedPreferences,
  setCachedFavorites,
  setCachedPreferences
} from '../lib/notification-cache';
import { createNotificationWorker, createUrgentNotificationWorker } from '../lib/notification-queue';

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

// Helper function to extract state from stop string
// Enhanced to work with full addresses using new parsing
function extractStateFromStop(stop: string): string | null {
  if (!stop || typeof stop !== 'string') return null;
  
  // Use the new parseAddress function for better parsing
  try {
    const { extractCityStateForMatching } = require('../lib/format');
    const cityState = extractCityStateForMatching(stop);
    if (cityState && cityState.state) {
      return cityState.state;
    }
  } catch (error) {
    // Fallback to regex if import fails
    console.warn('[NotificationWorker] Could not use new parsing, falling back to regex:', error);
  }
  
  // Fallback to original regex-based extraction (for backward compatibility)
  const trimmed = stop.trim().toUpperCase();
  
  // List of valid US state abbreviations
  const validStates = new Set([
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
    'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
    'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
    'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
  ]);
  
  // Try to find state abbreviation in various patterns
  // Pattern 1: "CITY, ST" or "CITY, ST ZIP"
  let match = trimmed.match(/,\s*([A-Z]{2})(?:\s|$)/);
  if (match && validStates.has(match[1])) return match[1];
  
  // Pattern 2: "CITY ST" (no comma)
  match = trimmed.match(/\s+([A-Z]{2})$/);
  if (match && validStates.has(match[1])) return match[1];
  
  // Pattern 3: "ST" at the end
  match = trimmed.match(/([A-Z]{2})$/);
  if (match && validStates.has(match[1])) return match[1];
  
  return null;
}

// NEW: Extract city from stop (for exact matching)
function extractCityFromStop(stop: string): string | null {
  if (!stop || typeof stop !== 'string') return null;
  
  try {
    const { extractCityStateForMatching } = require('../lib/format');
    const cityState = extractCityStateForMatching(stop);
    return cityState ? cityState.city : null;
  } catch (error) {
    // Fallback: try to extract city from comma-separated format
    const parts = stop.split(',').map(p => p.trim());
    return parts[0] || null;
  }
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
        
        // Use new parsing to extract city/state for cleaner display (with city name cleaning)
        // This ensures addresses like "NW HURON, SD" become "HURON, SD" in notifications
        try {
          const { extractCityStateForMatching } = require('../lib/format');
          const originCityState = extractCityStateForMatching(origin);
          const destinationCityState = extractCityStateForMatching(destination);
          
          // extractCityStateForMatching already uses parseAddress which includes cleanCityName
          // So the city names are already cleaned (e.g., "NW HURON" → "HURON", "RM 114 AKRON" → "AKRON")
          if (originCityState) {
            origin = `${originCityState.city}, ${originCityState.state}`;
          }
          if (destinationCityState) {
            destination = `${destinationCityState.city}, ${destinationCityState.state}`;
          }
        } catch (error) {
          // Fallback to raw strings if parsing fails
          console.warn(`[LoadDetails] Could not parse addresses for bid ${bidNumber}:`, error);
        }
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

  // Check rate limit with tiered system (limit determined by user tier)
  // No explicit limit passed - will use tier-based limits
  const canSend = await checkRateLimit(userId, undefined, 3600);
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
  // Check per-trigger-type rate limit (allows higher limits for high-priority triggers)
  const canSend = await checkRateLimit(userId, undefined, 3600, trigger.triggerType);
  if (!canSend) {
    console.log(`Rate limit exceeded for user ${userId} on trigger type ${trigger.triggerType}, skipping`);
    return 0;
  }
  
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

// Process state preference bid trigger
async function processSimilarLoadTrigger(
  userId: string,
  trigger: { id: number; triggerType: string; triggerConfig: any },
  preferences: any,
  favorites: any[]
): Promise<number> {
  const config = trigger.triggerConfig || {};
  
  // Use state preferences from trigger config, or fall back to user preferences
  const statePreferences = config.statePreferences || preferences?.state_preferences || [];
  const distanceThreshold = config.distanceThreshold || preferences?.distance_threshold_miles || 50;

  // Skip if no state preferences are set
  if (!statePreferences || statePreferences.length === 0) {
    console.log(`[SimilarLoad] No state preferences configured for user ${userId}, skipping`);
    return 0;
  }

  console.log(`[SimilarLoad] Processing state preference trigger for user ${userId}, states: ${statePreferences.join(', ')}, threshold: ${distanceThreshold}mi`);

  // Find state preference bid matches
  const similarLoads = await sql`
    SELECT * FROM find_similar_loads(
      ${userId},
      ${distanceThreshold},
      ${statePreferences}
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
        load, // This is actually a bid from telegram_bids table
        preferences as AdvancedNotificationPreferences,
        favorites
      );

      if (shouldTrigger.shouldNotify) {
        // Build detailed message with score breakdown
        // Note: All bids use the same equipment, so equipment score is not shown
        let message = `High-match bid found! ${load.bid_number} - ${load.distance_miles}mi, ${load.tag}. Match: ${Math.round(shouldTrigger.matchScore || load.similarity_score)}%.`;
        if (shouldTrigger.scoreBreakdown) {
          message += ` Breakdown: Route ${shouldTrigger.scoreBreakdown.routeScore}pts, Distance ${shouldTrigger.scoreBreakdown.distanceScore}pts.`;
        }
        
        // Get load details for email
        const loadDetails = await getLoadDetails(load.bid_number);
        
        // Use a valid trigger ID (0 for virtual triggers with id: -1)
        const triggerId = trigger.id > 0 ? trigger.id : 0;
        
        await sendNotification({
          carrierUserId: userId,
          triggerId: triggerId,
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
  // Parse triggerConfig if it's a string (JSONB from database might be stringified)
  let config = trigger.triggerConfig || {};
  if (typeof config === 'string') {
    try {
      config = JSON.parse(config);
    } catch (e) {
      console.error(`[ExactMatch] Error parsing trigger_config for trigger ${trigger.id}:`, e);
      config = {};
    }
  }
  
  // Check for new distance range format or legacy bid numbers
  const favoriteDistanceRange = config.favoriteDistanceRange;
  const favoriteBidNumbers = config.favoriteBidNumbers || [];
  
  let favoriteRoutes: any[] = [];
  
  // Priority 1: Check for specific bid number first
  if (config.favoriteBidNumber) {
    console.log(`[ExactMatch] Processing trigger ${trigger.id} with specific bid number: ${config.favoriteBidNumber}`);
    
    favoriteRoutes = await sql`
      SELECT 
        cf.bid_number as favorite_bid,
        tb.stops as favorite_stops,
        tb.tag as favorite_tag,
        tb.distance_miles as favorite_distance
      FROM carrier_favorites cf
      JOIN telegram_bids tb ON cf.bid_number = tb.bid_number
      WHERE cf.supabase_carrier_user_id = ${userId}
        AND cf.bid_number = ${config.favoriteBidNumber}
    `;
    
    // Use stored favoriteStops from config if available (more accurate than DB)
    if (favoriteRoutes.length > 0 && config.favoriteStops) {
      favoriteRoutes[0].favorite_stops = config.favoriteStops;
    }
  } else if (favoriteDistanceRange) {
    // Priority 2: Use distance range (fallback)
    console.log(`[ExactMatch] Processing trigger ${trigger.id} with distance range: ${favoriteDistanceRange.minDistance}-${favoriteDistanceRange.maxDistance} miles`);
    
    // Get favorite routes within the distance range
    favoriteRoutes = await sql`
      SELECT 
        cf.bid_number as favorite_bid,
        tb.stops as favorite_stops,
        tb.tag as favorite_tag,
        tb.distance_miles as favorite_distance
      FROM carrier_favorites cf
      JOIN telegram_bids tb ON cf.bid_number = tb.bid_number
      WHERE cf.supabase_carrier_user_id = ${userId}
        AND tb.distance_miles >= ${favoriteDistanceRange.minDistance}
        AND tb.distance_miles <= ${favoriteDistanceRange.maxDistance}
    `;
  } else if (favoriteBidNumbers.length > 0) {
    // Legacy format: use bid numbers
    console.log(`[ExactMatch] Processing trigger ${trigger.id} with ${favoriteBidNumbers.length} favorite bid(s): ${favoriteBidNumbers.join(', ')}`);
    
    favoriteRoutes = await sql`
      SELECT 
        cf.bid_number as favorite_bid,
        tb.stops as favorite_stops,
        tb.tag as favorite_tag,
        tb.distance_miles as favorite_distance
      FROM carrier_favorites cf
      JOIN telegram_bids tb ON cf.bid_number = tb.bid_number
      WHERE cf.supabase_carrier_user_id = ${userId}
        AND cf.bid_number = ANY(${favoriteBidNumbers})
    `;
  } else {
    console.log(`[ExactMatch] No favorite distance range or bid numbers configured for trigger ${trigger.id}`);
    console.log(`[ExactMatch] Config received:`, JSON.stringify(config));
    return 0;
  }

  if (favoriteRoutes.length === 0) {
    console.log(`[ExactMatch] No favorite routes found for user ${userId}`);
    return 0;
  }

  let count = 0;

  // Determine match type from config
  const matchType = config.matchType || 'exact'; // 'exact' or 'state'
  const originState = config.originState;
  const destinationState = config.destinationState;

  // For each favorite route, find matches in active bids
  for (const favorite of favoriteRoutes) {
    const favoriteStops = parseStops(favorite.favorite_stops);
    if (favoriteStops.length === 0) continue;

    const origin = favoriteStops[0];
    const destination = favoriteStops[favoriteStops.length - 1];

    // Extract city and state from favorite stops (using new parsing for full addresses)
    // Note: extractCityStateForMatching uses parseAddress which includes cleanCityName
    // So city names are automatically cleaned (e.g., "NW HURON" → "HURON", "RM 114 AKRON" → "AKRON")
    let favoriteOriginCityState: { city: string; state: string } | null = null;
    let favoriteDestCityState: { city: string; state: string } | null = null;
    
    try {
      const { extractCityStateForMatching } = require('../lib/format');
      favoriteOriginCityState = extractCityStateForMatching(origin);
      favoriteDestCityState = extractCityStateForMatching(destination);
    } catch (error) {
      console.warn(`[ExactMatch] Could not use new parsing, falling back to regex:`, error);
    }
    
    // Extract states from favorite for state matching (fallback if parsing failed)
    const favoriteOriginState = favoriteOriginCityState?.state || extractStateFromStop(origin);
    const favoriteDestState = favoriteDestCityState?.state || extractStateFromStop(destination);
    
    if (!favoriteOriginCityState || !favoriteDestCityState) {
      console.warn(`[ExactMatch] Could not extract city/state from favorite stops: ${origin}, ${destination}`);
      continue;
    }

    // Find active bids with route match
    // For exact match: NO distance filtering (only route matters)
    // For state match: Apply distance range filtering
    let routeMatches;
    if (matchType === 'exact') {
      // Exact match: Only filter by route, NOT by distance
      // Use more robust matching - check both text LIKE and array contains
      console.log(`[ExactMatch] Searching for exact match: origin="${origin}", dest="${destination}"`);
      routeMatches = await sql`
        SELECT 
          tb.bid_number,
          tb.stops,
          tb.distance_miles,
          tb.tag,
          tb.pickup_timestamp,
          tb.delivery_timestamp,
          tb.received_at
        FROM telegram_bids tb
        WHERE tb.is_archived = false
          AND NOW() <= (tb.received_at::timestamp + INTERVAL '25 minutes')
          AND tb.bid_number != ${favorite.favorite_bid}
          AND (
            -- Exact route match: same origin and destination (check as text - most reliable)
            (tb.stops::text LIKE ${`%${origin}%`} AND tb.stops::text LIKE ${`%${destination}%`})
            OR
            -- Tag match (state-based) - only if we have tag
            ${favorite.favorite_tag ? sql`(tb.tag = ${favorite.favorite_tag})` : sql`false`}
          )
        ORDER BY tb.received_at DESC
        LIMIT 10
      `;
      console.log(`[ExactMatch] Found ${routeMatches.length} potential matches for exact match query`);
      if (routeMatches.length > 0) {
        console.log(`[ExactMatch] Potential matches:`, routeMatches.map(m => ({ bid: m.bid_number, stops: m.stops })));
      }
    } else if (matchType === 'state' && favoriteDistanceRange) {
      // State match: Apply distance range filtering to the load's distance
      routeMatches = await sql`
        SELECT 
          tb.bid_number,
          tb.stops,
          tb.distance_miles,
          tb.tag,
          tb.pickup_timestamp,
          tb.delivery_timestamp,
          tb.received_at
        FROM telegram_bids tb
        WHERE tb.is_archived = false
          AND NOW() <= (tb.received_at::timestamp + INTERVAL '25 minutes')
          AND tb.distance_miles >= ${favoriteDistanceRange.minDistance}
          AND tb.distance_miles <= ${favoriteDistanceRange.maxDistance}
          AND (
            -- Exact route match: same origin and destination (for state matching, we'll verify states later)
            (tb.stops::text LIKE ${`%${origin}%`} AND tb.stops::text LIKE ${`%${destination}%`})
            OR
            -- Tag match (state-based)
            (tb.tag = ${favorite.favorite_tag})
          )
        ORDER BY tb.received_at DESC
        LIMIT 10
      `;
    } else {
      // State match without distance range (legacy) or fallback
      routeMatches = await sql`
        SELECT 
          tb.bid_number,
          tb.stops,
          tb.distance_miles,
          tb.tag,
          tb.pickup_timestamp,
          tb.delivery_timestamp,
          tb.received_at
        FROM telegram_bids tb
        WHERE tb.is_archived = false
          AND NOW() <= (tb.received_at::timestamp + INTERVAL '25 minutes')
          AND tb.bid_number != ${favorite.favorite_bid}
          AND (
            -- Exact route match: same origin and destination
            (tb.stops::text LIKE ${`%${origin}%`} AND tb.stops::text LIKE ${`%${destination}%`})
            OR
            -- Tag match (state-based)
            (tb.tag = ${favorite.favorite_tag})
          )
        ORDER BY tb.received_at DESC
        LIMIT 10
      `;
    }

    for (const match of routeMatches) {
      // Check if we've already notified about this bid (30 second cooldown to allow rapid notifications for different matching bids)
      const recentNotification = await sql`
        SELECT id
        FROM notification_logs
        WHERE supabase_carrier_user_id = ${userId}
          AND trigger_id = ${trigger.id}
          AND bid_number = ${match.bid_number}
          AND sent_at > NOW() - INTERVAL '30 seconds'
        LIMIT 1
      `;

      if (recentNotification.length > 0) continue;

      // Verify it's actually a match by checking stops
      const matchStops = parseStops(match.stops);
      if (matchStops.length === 0) continue;

      const matchOrigin = matchStops[0];
      const matchDest = matchStops[matchStops.length - 1];

      // Extract city and state from match stops (using new parsing for full addresses)
      // Note: extractCityStateForMatching uses parseAddress which includes cleanCityName
      // So city names are automatically cleaned for consistent matching
      let matchOriginCityState: { city: string; state: string } | null = null;
      let matchDestCityState: { city: string; state: string } | null = null;
      
      try {
        const { extractCityStateForMatching } = require('../lib/format');
        matchOriginCityState = extractCityStateForMatching(matchOrigin);
        matchDestCityState = extractCityStateForMatching(matchDest);
      } catch (error) {
        console.warn(`[ExactMatch] Could not use new parsing for match, falling back to regex:`, error);
      }
      
      if (!matchOriginCityState || !matchDestCityState) {
        // Fallback: try to extract from strings directly
        continue; // Skip if we can't parse
      }

      // Extract states from match
      const matchOriginState = matchOriginCityState.state;
      const matchDestState = matchDestCityState.state;

      // Check for exact match (city-to-city) - NOW USES PARSED CITY/STATE
      const isExactMatch = (
        matchOriginCityState.city.toUpperCase().trim() === favoriteOriginCityState.city.toUpperCase().trim() &&
        matchDestCityState.city.toUpperCase().trim() === favoriteDestCityState.city.toUpperCase().trim()
      );

      // Check for state match (state-to-state)
      const isStateMatch = (
        matchType === 'state' &&
        matchOriginState && matchDestState &&
        favoriteOriginState && favoriteDestState &&
        matchOriginState === favoriteOriginState &&
        matchDestState === favoriteDestState
      ) || (
        matchType === 'state' &&
        originState && destinationState &&
        matchOriginState === originState &&
        matchDestState === destinationState
      );

      // Check for backhaul match (reverse route) - NOW USES PARSED CITY/STATE
      const isBackhaulMatch = (
        matchOriginCityState.city.toUpperCase().trim() === favoriteDestCityState.city.toUpperCase().trim() &&
        matchDestCityState.city.toUpperCase().trim() === favoriteOriginCityState.city.toUpperCase().trim()
      );

      // Check for backhaul state match if enabled
      const isBackhaulStateMatch = (
        matchType === 'state' &&
        matchOriginState && matchDestState &&
        favoriteOriginState && favoriteDestState &&
        matchOriginState === favoriteDestState &&
        matchDestState === favoriteOriginState
      ) || (
        matchType === 'state' &&
        originState && destinationState &&
        matchOriginState === destinationState &&
        matchDestState === originState
      );

      // Check if backhaul is enabled - prioritize trigger-specific setting
      const backhaulEnabled = config.backhaulEnabled !== undefined 
        ? config.backhaulEnabled 
        : (preferences?.prioritize_backhaul || 
           preferences?.prioritizeBackhaul || 
           false);

      // Determine if this match should trigger notification
      const shouldNotify = 
        (matchType === 'exact' && (isExactMatch || (isBackhaulMatch && backhaulEnabled))) ||
        (matchType === 'state' && (isStateMatch || (isBackhaulStateMatch && backhaulEnabled)));

      // Log matching details for debugging exact matches
      if (matchType === 'exact') {
        if (shouldNotify) {
          console.log(`[ExactMatch] ✅ MATCH FOUND for bid ${match.bid_number}:`, {
            favoriteOrigin: `${favoriteOriginCityState.city}, ${favoriteOriginCityState.state}`,
            favoriteDest: `${favoriteDestCityState.city}, ${favoriteDestCityState.state}`,
            matchOrigin: `${matchOriginCityState.city}, ${matchOriginCityState.state}`,
            matchDest: `${matchDestCityState.city}, ${matchDestCityState.state}`,
            isExactMatch,
            isBackhaulMatch,
            backhaulEnabled
          });
        } else {
          console.log(`[ExactMatch] ❌ NO MATCH for bid ${match.bid_number}:`, {
            favoriteOrigin: `${favoriteOriginCityState.city}, ${favoriteOriginCityState.state}`,
            favoriteDest: `${favoriteDestCityState.city}, ${favoriteDestCityState.state}`,
            matchOrigin: `${matchOriginCityState.city}, ${matchOriginCityState.state}`,
            matchDest: `${matchDestCityState.city}, ${matchDestCityState.state}`,
            isExactMatch,
            isBackhaulMatch,
            backhaulEnabled,
            reason: !isExactMatch && (!isBackhaulMatch || !backhaulEnabled) ? 'Not an exact match and backhaul not enabled' : 'Unknown'
          });
        }
      }

      if (shouldNotify) {
        // Apply min match score filter if enabled
        const useMinMatchScoreFilter = preferences?.use_min_match_score_filter !== false;
        if (useMinMatchScoreFilter && preferences?.min_match_score) {
          // For exact/state matches, we can calculate a simple score based on distance match
          const distanceDiff = Math.abs((match.distance_miles || 0) - (favorite.favorite_distance || 0));
          const maxDistance = Math.max(match.distance_miles || 0, favorite.favorite_distance || 0);
          const distanceScore = maxDistance > 0 ? Math.max(0, 100 - (distanceDiff / maxDistance * 100)) : 100;
          
          // Exact matches get higher score, state matches get slightly lower
          const matchScore = matchType === 'exact' ? Math.min(100, distanceScore + 20) : distanceScore;
          
          if (matchScore < preferences.min_match_score) {
            console.log(`[${matchType === 'exact' ? 'ExactMatch' : 'StateMatch'}] Match score ${matchScore}% below threshold ${preferences.min_match_score}%, skipping`);
            continue;
          }
        }

        // Check distance range if specified in preferences (ONLY for state match, NOT for exact match)
        // Exact match should not be filtered by distance - only route matters
        if (matchType === 'state' && preferences?.min_distance !== undefined && preferences?.max_distance !== undefined) {
          const loadDistance = match.distance_miles || 0;
          if (loadDistance < preferences.min_distance || loadDistance > preferences.max_distance) {
            console.log(`[StateMatch] Load distance ${loadDistance} outside range ${preferences.min_distance}-${preferences.max_distance}, skipping`);
            continue;
          }
        }

        const loadDetails = await getLoadDetails(match.bid_number);
        const finalMatchType = isBackhaulMatch || isBackhaulStateMatch ? 'backhaul' : matchType;
        const message = isBackhaulMatch || isBackhaulStateMatch
          ? `Backhaul ${matchType} match found! ${match.bid_number} - ${matchDestCityState.city}, ${matchDestCityState.state} → ${matchOriginCityState.city}, ${matchOriginCityState.state} (return route)`
          : matchType === 'state'
          ? `State match found! ${match.bid_number} - ${matchOriginState} → ${matchDestState}`
          : `Exact match found! ${match.bid_number} - ${favoriteOriginCityState.city}, ${favoriteOriginCityState.state} → ${favoriteDestCityState.city}, ${favoriteDestCityState.state}`;

        console.log(`[${matchType === 'exact' ? 'ExactMatch' : 'StateMatch'}] ${finalMatchType.toUpperCase()} match: ${match.bid_number} (backhaul enabled: ${backhaulEnabled})`);

        await sendNotification({
          carrierUserId: userId,
          triggerId: trigger.id,
          notificationType: isBackhaulMatch || isBackhaulStateMatch ? 'backhaul' : 'exact_match',
          bidNumber: match.bid_number,
          message,
          loadDetails: loadDetails || undefined,
          matchType: matchType, // Pass matchType for backhaul template
        });

        count++;
      }
    }
  }

  return count;
}

// Process new route trigger (simplified)
async function processNewRouteTrigger(
  userId: string,
  trigger: { id: number; triggerType: string; triggerConfig: any }
): Promise<number> {
  // TODO: Implement full new route processing
  return 0;
}

// Process favorite available trigger
async function processFavoriteAvailableTrigger(
  userId: string,
  trigger: { id: number; triggerType: string; triggerConfig: any }
): Promise<number> {
  const config = trigger.triggerConfig || {};
  const favoriteBidNumbers = config.favoriteBidNumbers || [];

  if (favoriteBidNumbers.length === 0) {
    console.log(`[FavoriteAvailable] No favorite bid numbers configured for trigger ${trigger.id}`);
    return 0;
  }

  let count = 0;

  // Check each favorite bid to see if it's still available
  for (const bidNumber of favoriteBidNumbers) {
    // Check if bid is still active (not archived and not expired)
    const activeBid = await sql`
      SELECT 
        tb.bid_number,
        tb.stops,
        tb.distance_miles,
        tb.tag,
        tb.pickup_timestamp,
        tb.delivery_timestamp,
        tb.received_at,
        (tb.received_at::timestamp + INTERVAL '25 minutes') as expires_at
      FROM telegram_bids tb
      WHERE tb.bid_number = ${bidNumber}
        AND tb.is_archived = false
        AND NOW() <= (tb.received_at::timestamp + INTERVAL '25 minutes')
      LIMIT 1
    `;

    if (activeBid.length === 0) {
      // Bid is not available (archived or expired)
      continue;
    }

    const bid = activeBid[0];

    // Check if we've already notified about this bid recently
    const recentNotification = await sql`
      SELECT id
      FROM notification_logs
      WHERE supabase_carrier_user_id = ${userId}
        AND trigger_id = ${trigger.id}
        AND bid_number = ${bidNumber}
        AND sent_at > NOW() - INTERVAL '6 hours'
      LIMIT 1
    `;

    if (recentNotification.length > 0) {
      // Already notified recently
      continue;
    }

    // Get load details for email
    const loadDetails = await getLoadDetails(bidNumber);
    const stops = parseStops(bid.stops);
    const origin = stops.length > 0 ? stops[0] : 'Origin';
    const destination = stops.length > 0 ? stops[stops.length - 1] : 'Destination';

    const message = `Your favorite load is available! ${bidNumber} - ${origin} → ${destination}`;

    await sendNotification({
      carrierUserId: userId,
      triggerId: trigger.id,
      notificationType: 'favorite_available',
      bidNumber: bidNumber,
      message,
      loadDetails: loadDetails || undefined,
    });

    count++;
  }

  return count;
}

// Process deadline approaching trigger
async function processDeadlineApproachingTrigger(
  userId: string,
  trigger: { id: number; triggerType: string; triggerConfig: any }
): Promise<number> {
  let count = 0;
  
  try {
    const config = trigger.triggerConfig || {};
    // Default to 5 minutes warning (notify when 5 minutes left)
    const timeThreshold = config.timeThreshold || 5; // minutes before deadline
    
    // Get user's favorites to check for deadline approaching
    const favorites = await sql`
      SELECT 
        cf.bid_number,
        tb.received_at,
        tb.stops,
        tb.distance_miles,
        tb.tag
      FROM carrier_favorites cf
      JOIN telegram_bids tb ON cf.bid_number = tb.bid_number
      WHERE cf.supabase_carrier_user_id = ${userId}
        AND tb.is_archived = false
        AND tb.received_at IS NOT NULL
    `;

    const now = new Date();
    
    for (const favorite of favorites) {
      const receivedAt = new Date(favorite.received_at);
      // Bids expire 25 minutes after received
      const expiresAt = new Date(receivedAt.getTime() + (25 * 60 * 1000));
      const minutesRemaining = Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60));
      
      // Only notify if within the threshold (e.g., 5 minutes remaining)
      if (minutesRemaining > 0 && minutesRemaining <= timeThreshold) {
        // Check cooldown - don't spam notifications for the same bid
        const recentNotification = await sql`
          SELECT sent_at
          FROM notification_logs
          WHERE supabase_carrier_user_id = ${userId}
            AND bid_number = ${favorite.bid_number}
            AND notification_type = 'deadline_approaching'
            AND sent_at > NOW() - INTERVAL '5 minutes'
          ORDER BY sent_at DESC
          LIMIT 1
        `;
        
        if (recentNotification.length > 0) {
          continue; // Already notified recently
        }
        
        const loadDetails = await getLoadDetails(favorite.bid_number);
        const message = `⏰ Bid ${favorite.bid_number} closing in ${minutesRemaining} minute${minutesRemaining !== 1 ? 's' : ''}! Act fast!`;
        
        await sendNotification({
          carrierUserId: userId,
          triggerId: trigger.id,
          notificationType: 'deadline_approaching',
          bidNumber: favorite.bid_number,
          message,
          loadDetails: loadDetails || undefined,
          minutesRemaining,
        });
        
        count++;
      }
    }
  } catch (error: any) {
    console.error(`[DeadlineApproaching] Error processing trigger ${trigger.id}:`, error?.message);
  }
  
  return count;
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
  matchType,
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
  matchType?: 'exact' | 'state'; // For backhaul notifications
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

    // Insert into notifications table for in-app notifications (unified table)
    // Include bid_number in data JSONB for reference
    await sql`
      INSERT INTO notifications (
        user_id,
        type,
        title,
        message,
        read,
        data
      )
      VALUES (
        ${carrierUserId},
        ${notificationType},
        ${getNotificationTitle(notificationType)},
        ${message},
        false,
        ${JSON.stringify({ bid_number: bidNumber })}
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
        case 'backhaul':
          emailResult = await sendEmail({
            to: carrierEmail,
            subject: `🔄 Backhaul Match Found: ${loadInfo.origin} → ${loadInfo.destination} (Return Route)`,
            react: BackhaulNotificationTemplate({
              bidNumber,
              origin: loadInfo.origin,
              destination: loadInfo.destination,
              miles: loadInfo.miles,
              stops: loadInfo.stops,
              pickupTime: loadInfo.pickupTime,
              deliveryTime: loadInfo.deliveryTime,
              viewUrl,
              carrierName: carrierName || undefined,
              matchType: matchType || 'exact',
            }),
          });
          break;

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
            subject: `🚚 State Preference Bid Found: ${bidNumber} (${matchScore || 0}% match)`,
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
      return 'State Preference Bid Found';
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

