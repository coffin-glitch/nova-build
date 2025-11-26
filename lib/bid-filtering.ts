/**
 * Bid Filtering Utilities
 * 
 * Pre-filters notification triggers based on new bid information
 * to avoid enqueueing jobs for users who can't possibly match
 */

import sql from './db';

/**
 * Extract state from a stop string (e.g., "SALT LAKE CITY, UT 84199" → "UT")
 */
export function extractStateFromStop(stop: string): string | null {
  if (!stop || typeof stop !== 'string') return null;
  
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

/**
 * Get bid information for filtering
 */
export async function getBidInfoForFiltering(bidNumber: string): Promise<{
  originState: string | null;
  destinationState: string | null;
  origin: string | null;
  destination: string | null;
  distance: number | null;
  tag: string | null;
} | null> {
  try {
    const bidResult = await sql`
      SELECT 
        stops,
        distance_miles,
        tag
      FROM telegram_bids
      WHERE bid_number = ${bidNumber}
      LIMIT 1
    `;
    
    if (bidResult.length === 0) {
      return null;
    }
    
    const bid = bidResult[0];
    
    // Parse stops
    let stopsArray: string[] = [];
    if (bid.stops) {
      if (Array.isArray(bid.stops)) {
        stopsArray = bid.stops;
      } else if (typeof bid.stops === 'string') {
        try {
          const parsed = JSON.parse(bid.stops);
          stopsArray = Array.isArray(parsed) ? parsed : [parsed];
        } catch {
          stopsArray = [bid.stops];
        }
      }
    }
    
    const origin = stopsArray.length > 0 ? stopsArray[0] : null;
    const destination = stopsArray.length > 0 ? stopsArray[stopsArray.length - 1] : null;
    
    const originState = origin ? extractStateFromStop(origin) : null;
    const destinationState = destination ? extractStateFromStop(destination) : null;
    
    return {
      originState,
      destinationState,
      origin,
      destination,
      distance: bid.distance_miles ? parseFloat(bid.distance_miles) : null,
      tag: bid.tag || null,
    };
  } catch (error) {
    console.error(`[BidFiltering] Error getting bid info for ${bidNumber}:`, error);
    return null;
  }
}

/**
 * Filter triggers that could potentially match a new bid
 * This dramatically reduces the number of jobs enqueued
 */
export async function filterRelevantTriggers(
  bidInfo: {
    originState: string | null;
    destinationState: string | null;
    origin: string | null;
    destination: string | null;
    distance: number | null;
    tag: string | null;
  }
): Promise<any[]> {
  const { originState, destinationState, origin, destination, distance, tag } = bidInfo;
  
  // If we can't extract state info, fall back to checking all triggers (safe default)
  if (!originState && !destinationState && !origin && !destination) {
    console.log('[BidFiltering] Cannot extract bid route info, checking all triggers (safe fallback)');
    const allTriggers = await sql`
      SELECT 
        nt.id,
        nt.supabase_carrier_user_id,
        nt.trigger_type,
        nt.trigger_config,
        nt.is_active
      FROM notification_triggers nt
      WHERE nt.is_active = true
    `;
    return allTriggers;
  }
  
  console.log(`[BidFiltering] Filtering triggers for bid: ${origin} → ${destination} (${originState} → ${destinationState})`);
  
  // Build filter conditions
  const relevantTriggers: any[] = [];
  
  // 1. State preference triggers (similar_load): Check if origin state matches user preferences
  if (originState) {
    const statePrefTriggers = await sql`
      SELECT 
        nt.id,
        nt.supabase_carrier_user_id,
        nt.trigger_type,
        nt.trigger_config,
        nt.is_active
      FROM notification_triggers nt
      WHERE nt.is_active = true
        AND nt.trigger_type = 'similar_load'
        AND (
          -- Check if trigger config has state preferences that include origin state
          nt.trigger_config->'statePreferences' @> ${JSON.stringify([originState])}::jsonb
          OR
          -- Also check for legacy format or string arrays
          EXISTS (
            SELECT 1 
            FROM jsonb_array_elements_text(nt.trigger_config->'statePreferences') AS pref
            WHERE pref = ${originState}
          )
        )
    `;
    
    relevantTriggers.push(...statePrefTriggers);
    console.log(`[BidFiltering] Found ${statePrefTriggers.length} state preference triggers matching origin state ${originState}`);
  }
  
  // 2. Exact match triggers: Check if route could match
  // For exact matches, we need to check if the bid's route matches the favorite route
  // This is more complex, so we'll check triggers that have favoriteStops configured
  if (origin && destination) {
    // Check for exact match triggers where the favorite stops might match
    // We'll do a text-based check on the trigger config
    const exactMatchTriggers = await sql`
      SELECT 
        nt.id,
        nt.supabase_carrier_user_id,
        nt.trigger_type,
        nt.trigger_config,
        nt.is_active
      FROM notification_triggers nt
      WHERE nt.is_active = true
        AND nt.trigger_type = 'exact_match'
        AND (
          -- Check if favoriteStops contains origin or destination
          (nt.trigger_config->>'favoriteStops' IS NOT NULL AND
           (nt.trigger_config->>'favoriteStops' LIKE ${`%${origin}%`} OR
            nt.trigger_config->>'favoriteStops' LIKE ${`%${destination}%`}))
          OR
          -- Check if favoriteBidNumber is set (we'll check this in the worker)
          nt.trigger_config->>'favoriteBidNumber' IS NOT NULL
          OR
          -- Check if tag matches (for state-based matching)
          (${tag} IS NOT NULL AND nt.trigger_config->>'favoriteTag' = ${tag})
        )
    `;
    
    relevantTriggers.push(...exactMatchTriggers);
    console.log(`[BidFiltering] Found ${exactMatchTriggers.length} exact match triggers that might match route`);
  }
  
  // 3. Deadline approaching triggers: Check all (they check favorites, not route)
  // These are less common, so checking all is fine
  const deadlineTriggers = await sql`
    SELECT 
      nt.id,
      nt.supabase_carrier_user_id,
      nt.trigger_type,
      nt.trigger_config,
      nt.is_active
    FROM notification_triggers nt
    WHERE nt.is_active = true
      AND nt.trigger_type = 'deadline_approaching'
  `;
  
  relevantTriggers.push(...deadlineTriggers);
  console.log(`[BidFiltering] Found ${deadlineTriggers.length} deadline approaching triggers`);
  
  // 4. Other trigger types (favorite_available, new_route, etc.)
  // Check all for safety
  const otherTriggers = await sql`
    SELECT 
      nt.id,
      nt.supabase_carrier_user_id,
      nt.trigger_type,
      nt.trigger_config,
      nt.is_active
    FROM notification_triggers nt
    WHERE nt.is_active = true
      AND nt.trigger_type NOT IN ('similar_load', 'exact_match', 'deadline_approaching')
  `;
  
  relevantTriggers.push(...otherTriggers);
  console.log(`[BidFiltering] Found ${otherTriggers.length} other triggers`);
  
  // Remove duplicates (same trigger might match multiple conditions)
  const uniqueTriggers = new Map<string, any>();
  for (const trigger of relevantTriggers) {
    const key = `${trigger.supabase_carrier_user_id}-${trigger.id}`;
    if (!uniqueTriggers.has(key)) {
      uniqueTriggers.set(key, trigger);
    }
  }
  
  const filteredTriggers = Array.from(uniqueTriggers.values());
  console.log(`[BidFiltering] Total unique relevant triggers: ${filteredTriggers.length} (after deduplication)`);
  
  return filteredTriggers;
}

/**
 * Filter users with state preferences who don't have explicit triggers
 * Only include users whose state preferences match the bid's origin state
 */
export async function filterRelevantStatePreferenceUsers(
  bidInfo: {
    originState: string | null;
    destinationState: string | null;
  }
): Promise<any[]> {
  const { originState } = bidInfo;
  
  // If we can't extract origin state, don't filter (safe fallback)
  if (!originState) {
    console.log('[BidFiltering] Cannot extract origin state, checking all state preference users (safe fallback)');
    const allUsers = await sql`
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
    return allUsers;
  }
  
  console.log(`[BidFiltering] Filtering state preference users for origin state: ${originState}`);
  
  // Only get users whose state preferences include the bid's origin state
  const relevantUsers = await sql`
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
      AND ${originState} = ANY(cnp.state_preferences)
      AND NOT EXISTS (
        SELECT 1 FROM notification_triggers nt
        WHERE nt.supabase_carrier_user_id = cnp.supabase_carrier_user_id
          AND nt.trigger_type = 'similar_load'
          AND nt.is_active = true
      )
  `;
  
  console.log(`[BidFiltering] Found ${relevantUsers.length} state preference users matching origin state ${originState}`);
  
  return relevantUsers;
}

