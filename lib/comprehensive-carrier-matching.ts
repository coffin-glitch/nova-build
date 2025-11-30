/**
 * Comprehensive Carrier Matching System
 * 
 * When a new bid arrives, this system checks ALL carriers' preferences:
 * - Favorites (exact match, state match, backhaul)
 * - State preferences
 * - All notification settings
 * 
 * This ensures every carrier is notified if the bid matches their preferences,
 * even if they don't have explicit triggers set up.
 */

import sql from './db';

export interface BidInfo {
  bidNumber: string;
  origin: string;
  destination: string;
  originState: string | null;
  destinationState: string | null;
  distance: number | null;
  tag: string | null;
}

export interface CarrierMatch {
  userId: string;
  matchType: 'exact_match' | 'state_match' | 'backhaul' | 'favorite_available' | 'state_preference';
  favoriteBidNumber?: string;
  triggerConfig: any;
  triggerType: 'exact_match' | 'similar_load' | 'favorite_available'; // The trigger type to use in the worker
}

/**
 * Find ALL carriers whose favorites match the new bid
 * This checks for exact matches, state matches, and backhaul matches
 * 
 * OPTIMIZED: Uses SQL text matching first, then validates in JavaScript for accuracy
 * This scales better for thousands of carriers
 */
export async function findCarriersWithMatchingFavorites(bidInfo: BidInfo): Promise<CarrierMatch[]> {
  const { bidNumber, origin, destination, originState, destinationState } = bidInfo;
  
  if (!origin || !destination || !originState || !destinationState) {
    return [];
  }

  const matches: CarrierMatch[] = [];

  try {
    // OPTIMIZATION: Use SQL to pre-filter favorites that might match
    // This reduces the dataset before JavaScript processing
    // We check for:
    // 1. Exact text matches (origin/destination in stops)
    // 2. State matches (state codes in stops)
    // 3. Backhaul matches (reverse origin/destination)
    // 
    // IMPORTANT: Exclude carriers who already have explicit triggers for these favorites
    // This prevents duplicate notifications and ensures we only notify carriers who
    // haven't set up explicit triggers yet
    
    const potentialMatches = await sql`
      SELECT DISTINCT
        cf.supabase_carrier_user_id as user_id,
        cf.bid_number as favorite_bid_number,
        tb.stops as favorite_stops,
        tb.tag as favorite_tag,
        tb.distance_miles as favorite_distance,
        COALESCE(cnp.prioritize_backhaul, true) as prioritize_backhaul
      FROM carrier_favorites cf
      JOIN telegram_bids tb ON cf.bid_number = tb.bid_number
      LEFT JOIN carrier_notification_preferences cnp 
        ON cf.supabase_carrier_user_id = cnp.supabase_carrier_user_id
      WHERE cf.supabase_carrier_user_id IS NOT NULL
        AND tb.stops IS NOT NULL
        AND jsonb_typeof(tb.stops) = 'array'
        AND CASE 
          WHEN jsonb_typeof(tb.stops) = 'array' 
          THEN jsonb_array_length(tb.stops) >= 2
          ELSE false
        END
        -- Exclude carriers who already have explicit triggers for this favorite
        AND NOT EXISTS (
          SELECT 1 FROM notification_triggers nt
          WHERE nt.supabase_carrier_user_id = cf.supabase_carrier_user_id
            AND nt.is_active = true
            AND (
              -- Check if trigger is for this exact favorite bid
              (nt.trigger_config->>'favoriteBidNumber' = cf.bid_number)
              OR
              -- Check if trigger is for exact match with this favorite's route
              (nt.trigger_type = 'exact_match' 
               AND nt.trigger_config->>'favoriteBidNumber' = cf.bid_number)
            )
        )
        AND (
          -- Potential exact match: new bid origin/destination appear in favorite stops
          (tb.stops::text LIKE ${`%${origin}%`} AND tb.stops::text LIKE ${`%${destination}%`})
          OR
          -- Potential state match: new bid states appear in favorite stops
          (tb.stops::text LIKE ${`%, ${originState}%`} AND tb.stops::text LIKE ${`%, ${destinationState}%`})
          OR
          -- Potential backhaul: new bid origin/destination reversed in favorite stops
          (tb.stops::text LIKE ${`%${destination}%`} AND tb.stops::text LIKE ${`%${origin}%`})
        )
    `;

    console.log(`[ComprehensiveMatching] Found ${potentialMatches.length} potential favorite matches (pre-filtered by SQL)`);

    if (potentialMatches.length === 0) {
      return [];
    }

    // Import parsing functions for accurate matching
    const { extractCityStateForMatching } = require('./format');

    // Parse new bid route once
    let bidOriginCityState: { city: string; state: string } | null = null;
    let bidDestCityState: { city: string; state: string } | null = null;

    try {
      bidOriginCityState = extractCityStateForMatching(origin);
      bidDestCityState = extractCityStateForMatching(destination);
    } catch (error) {
      console.warn(`[ComprehensiveMatching] Could not parse new bid route:`, error);
      return [];
    }

    if (!bidOriginCityState || !bidDestCityState) {
      return [];
    }

    // Validate each potential match with accurate parsing
    for (const favorite of potentialMatches) {
      const userId = favorite.user_id;
      const favoriteStops = Array.isArray(favorite.favorite_stops) 
        ? favorite.favorite_stops 
        : JSON.parse(favorite.favorite_stops || '[]');

      if (favoriteStops.length < 2) continue;

      const favoriteOrigin = favoriteStops[0];
      const favoriteDestination = favoriteStops[favoriteStops.length - 1];

      // Parse favorite route
      let favoriteOriginCityState: { city: string; state: string } | null = null;
      let favoriteDestCityState: { city: string; state: string } | null = null;

      try {
        favoriteOriginCityState = extractCityStateForMatching(favoriteOrigin);
        favoriteDestCityState = extractCityStateForMatching(favoriteDestination);
      } catch (error) {
        continue; // Skip if we can't parse
      }

      if (!favoriteOriginCityState || !favoriteDestCityState) continue;

      const backhaulEnabled = favorite.prioritize_backhaul !== false; // Default to true

      // Check for exact match (city-to-city)
      const isExactMatch = (
        bidOriginCityState.city.toUpperCase().trim() === favoriteOriginCityState.city.toUpperCase().trim() &&
        bidDestCityState.city.toUpperCase().trim() === favoriteDestCityState.city.toUpperCase().trim()
      );

      // Check for state match (state-to-state)
      const isStateMatch = (
        bidOriginCityState.state === favoriteOriginCityState.state &&
        bidDestCityState.state === favoriteDestCityState.state
      );

      // Check for backhaul match (reverse route)
      const isBackhaulMatch = backhaulEnabled && (
        bidOriginCityState.city.toUpperCase().trim() === favoriteDestCityState.city.toUpperCase().trim() &&
        bidDestCityState.city.toUpperCase().trim() === favoriteOriginCityState.city.toUpperCase().trim()
      );

      // Check for backhaul state match
      const isBackhaulStateMatch = backhaulEnabled && (
        bidOriginCityState.state === favoriteDestCityState.state &&
        bidDestCityState.state === favoriteOriginCityState.state
      );

      // Determine match type and create trigger config
      // Note: All favorite-based matches use 'exact_match' trigger type
      // The worker's processExactMatchTrigger handles both exact and state matches via config.matchType
      if (isExactMatch) {
        matches.push({
          userId,
          matchType: 'exact_match',
          triggerType: 'exact_match',
          favoriteBidNumber: favorite.favorite_bid_number,
          triggerConfig: {
            favoriteBidNumber: favorite.favorite_bid_number,
            favoriteStops: favoriteStops,
            favoriteOriginCityState,
            favoriteDestCityState,
            matchType: 'exact', // Worker expects 'exact' or 'state'
            backhaulEnabled,
          },
        });
      } else if (isBackhaulMatch) {
        matches.push({
          userId,
          matchType: 'backhaul',
          triggerType: 'exact_match', // Backhaul uses exact_match trigger type
          favoriteBidNumber: favorite.favorite_bid_number,
          triggerConfig: {
            favoriteBidNumber: favorite.favorite_bid_number,
            favoriteStops: favoriteStops,
            favoriteOriginCityState,
            favoriteDestCityState,
            matchType: 'exact', // Backhaul exact match
            backhaulEnabled: true,
          },
        });
      } else if (isStateMatch) {
        matches.push({
          userId,
          matchType: 'state_match',
          triggerType: 'exact_match', // State matches from favorites use exact_match trigger type
          favoriteBidNumber: favorite.favorite_bid_number,
          triggerConfig: {
            favoriteBidNumber: favorite.favorite_bid_number,
            favoriteStops: favoriteStops,
            favoriteOriginCityState,
            favoriteDestCityState,
            matchType: 'state', // Worker expects 'state' for state matches
            originState: favoriteOriginCityState.state,
            destinationState: favoriteDestCityState.state,
            backhaulEnabled,
          },
        });
      } else if (isBackhaulStateMatch) {
        matches.push({
          userId,
          matchType: 'backhaul',
          triggerType: 'exact_match', // Backhaul state match uses exact_match trigger type
          favoriteBidNumber: favorite.favorite_bid_number,
          triggerConfig: {
            favoriteBidNumber: favorite.favorite_bid_number,
            favoriteStops: favoriteStops,
            favoriteOriginCityState,
            favoriteDestCityState,
            matchType: 'state', // Backhaul state match
            originState: favoriteOriginCityState.state,
            destinationState: favoriteDestCityState.state,
            backhaulEnabled: true,
          },
        });
      }
    }

    console.log(`[ComprehensiveMatching] Validated ${matches.length} carriers with matching favorites (from ${potentialMatches.length} potential matches)`);
    return matches;

  } catch (error) {
    console.error('[ComprehensiveMatching] Error finding matching carriers:', error);
    return [];
  }
}

/**
 * Find ALL carriers with state preferences that match the new bid
 * This is already handled in the webhook, but we include it here for completeness
 */
export async function findCarriersWithStatePreferences(bidInfo: BidInfo): Promise<CarrierMatch[]> {
  const { originState } = bidInfo;
  
  if (!originState) {
    return [];
  }

  try {
    const carriers = await sql`
      SELECT DISTINCT
        cnp.supabase_carrier_user_id as user_id,
        cnp.state_preferences,
        cnp.distance_threshold_miles
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

    return carriers.map((carrier: any) => ({
      userId: carrier.user_id,
      matchType: 'state_preference' as const,
      triggerType: 'similar_load' as const, // State preferences use similar_load trigger type
      triggerConfig: {
        statePreferences: carrier.state_preferences,
        distanceThreshold: carrier.distance_threshold_miles || 50,
      },
    }));

  } catch (error) {
    console.error('[ComprehensiveMatching] Error finding state preference carriers:', error);
    return [];
  }
}

