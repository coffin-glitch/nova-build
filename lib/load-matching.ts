import { TelegramBid } from "@/lib/auctions";
import { getClerkUserInfo } from "@/lib/clerk-server";
import sql from "@/lib/db";
import { sendSimilarLoadNotificationEmail } from "@/lib/email/notify";

interface SimilarityScore {
  carrierUserId: string;
  bidNumber: string;
  score: number;
  reasons: string[];
}

interface LoadMatchingCriteria {
  distanceThreshold: number; // miles
  distanceVariancePercent: number; // percentage (flexibility)
  stateMatchWeight?: number; // Legacy - now using composite scoring
  distanceMatchWeight?: number; // Legacy - now using composite scoring
  timingMatchWeight?: number; // Legacy - now using composite scoring
  // New advanced fields
  timingRelevanceDays?: number; // Days ahead to consider for timing
  avoidHighCompetition?: boolean; // Apply competition penalty
  maxCompetitionBids?: number; // Maximum acceptable competition
}

const DEFAULT_CRITERIA: LoadMatchingCriteria = {
  distanceThreshold: 50,
  distanceVariancePercent: 20,
  stateMatchWeight: 0.4,
  distanceMatchWeight: 0.3,
  timingMatchWeight: 0.3,
};

/**
 * Calculate similarity score between a new load and carrier's favorite loads
 */
export async function calculateLoadSimilarity(
  carrierUserId: string,
  newLoad: TelegramBid,
  criteria: LoadMatchingCriteria = DEFAULT_CRITERIA
): Promise<SimilarityScore[]> {
  try {
    // Get carrier's favorite loads
    const favoriteLoads = await sql`
      SELECT 
        cf.bid_number,
        tb.stops,
        tb.distance_miles,
        tb.tag,
        tb.pickup_timestamp,
        tb.delivery_timestamp,
        tb.source_channel
      FROM carrier_favorites cf
      JOIN telegram_bids tb ON cf.bid_number = tb.bid_number
      WHERE cf.carrier_user_id = ${carrierUserId}
    `;

    if (favoriteLoads.length === 0) {
      return [];
    }

    const similarities: SimilarityScore[] = [];

    for (const favorite of favoriteLoads) {
      const score = await calculateSimilarityScore(favorite, newLoad, criteria);
      
      if (score.score > 0.3) { // Minimum threshold for notification
        similarities.push({
          carrierUserId,
          bidNumber: favorite.bid_number,
          score: score.score,
          reasons: score.reasons,
        });
      }
    }

    return similarities.sort((a, b) => b.score - a.score);
  } catch (error) {
    console.error('Error calculating load similarity:', error);
    return [];
  }
}

/**
 * Calculate similarity score between two loads
 */
async function calculateSimilarityScore(
  favoriteLoad: any,
  newLoad: TelegramBid,
  criteria: LoadMatchingCriteria
): Promise<{ score: number; reasons: string[] }> {
  const reasons: string[] = [];
  let routeScore = 0;
  let distanceScore = 0;
  let timingScore = 0;
  let tagScore = 0;

  // 1. Route Matching (40% weight) - Most important factor
  if (favoriteLoad.stops && newLoad.stops) {
    const favoriteStops = Array.isArray(favoriteLoad.stops) ? favoriteLoad.stops : JSON.parse(favoriteLoad.stops || '[]');
    const newStops = Array.isArray(newLoad.stops) ? newLoad.stops : JSON.parse(newLoad.stops || '[]');
    
    if (favoriteStops.length > 0 && newStops.length > 0) {
      const favOrigin = extractCityName(favoriteStops[0]).toUpperCase().trim();
      const favDest = extractCityName(favoriteStops[favoriteStops.length - 1]).toUpperCase().trim();
      const newOrigin = extractCityName(newStops[0]).toUpperCase().trim();
      const newDest = extractCityName(newStops[newStops.length - 1]).toUpperCase().trim();
      
      if (favOrigin === newOrigin && favDest === newDest) {
        routeScore = 100;
        reasons.push('Exact route match');
      } else if (favOrigin === newOrigin || favDest === newDest) {
        routeScore = 50;
        reasons.push('Partial route match');
      } else {
        const commonCities = findCommonCities(favoriteStops, newStops);
        if (commonCities.length > 0) {
          routeScore = 30;
          reasons.push(`Common cities: ${commonCities.join(', ')}`);
        }
      }
    }
  }

  // 2. Distance Matching (30% weight) - with flexibility
  if (favoriteLoad.distance_miles && newLoad.distance_miles) {
    const favoriteDistance = favoriteLoad.distance_miles;
    const newDistance = newLoad.distance_miles;
    const distanceDiff = Math.abs(favoriteDistance - newDistance);
    const percentDiff = (distanceDiff / favoriteDistance) * 100;
    const flexibility = criteria.distanceVariancePercent;
    
    if (percentDiff <= flexibility / 2) {
      distanceScore = 100;
      reasons.push(`Very similar distance (${distanceDiff.toFixed(0)}mi)`);
    } else if (percentDiff <= flexibility) {
      distanceScore = 80;
      reasons.push(`Similar distance (${distanceDiff.toFixed(0)}mi)`);
    } else if (percentDiff <= flexibility * 1.5) {
      distanceScore = 60;
      reasons.push(`Moderate distance (${distanceDiff.toFixed(0)}mi)`);
    } else {
      distanceScore = Math.max(0, 100 - percentDiff);
    }
  }

  // 3. Timing Relevance (20% weight) - based on days until pickup
  if (newLoad.pickup_timestamp) {
    const newPickup = new Date(newLoad.pickup_timestamp);
    const now = new Date();
    const daysUntilPickup = (newPickup.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    const relevanceWindow = (criteria as any).timingRelevanceDays || 7;
    
    if (daysUntilPickup >= 0 && daysUntilPickup <= relevanceWindow) {
      if (daysUntilPickup <= 1) {
        timingScore = 100;
        reasons.push('Pickup within 24 hours');
      } else if (daysUntilPickup <= 2) {
        timingScore = 90;
        reasons.push('Pickup within 2 days');
      } else if (daysUntilPickup <= 3) {
        timingScore = 75;
        reasons.push('Pickup within 3 days');
      } else {
        const remainingDays = Math.max(1, relevanceWindow - 3);
        const decayPercent = Math.max(0, (relevanceWindow - daysUntilPickup) / remainingDays);
        timingScore = 75 * decayPercent;
        reasons.push(`Pickup in ${daysUntilPickup.toFixed(1)} days`);
      }
    } else if (daysUntilPickup < 0) {
      timingScore = 10;
      reasons.push('Pickup time has passed');
    }
  }

  // 4. Tag/State Matching (10% weight)
  if (favoriteLoad.tag && newLoad.tag && favoriteLoad.tag === newLoad.tag) {
    tagScore = 100;
    reasons.push(`Same state/tag: ${favoriteLoad.tag}`);
  } else if (favoriteLoad.tag || newLoad.tag) {
    tagScore = 0;
  } else {
    tagScore = 50; // Neutral if no tags
  }

  // Calculate composite score with weights
  const compositeScore = (
    routeScore * 0.40 +
    distanceScore * 0.30 +
    timingScore * 0.20 +
    tagScore * 0.10
  );

  // Apply competition penalty if enabled
  let finalScore = compositeScore;
  if ((criteria as any).avoidHighCompetition && (newLoad as any).bids_count) {
    const maxBids = (criteria as any).maxCompetitionBids || 10;
    const bidCount = (newLoad as any).bids_count || 0;
    if (bidCount > maxBids) {
      const excessBids = bidCount - maxBids;
      const penalty = Math.min(30, excessBids * 5);
      finalScore = Math.max(0, finalScore - penalty);
      reasons.push(`Competition penalty: -${penalty.toFixed(0)}% (${bidCount} bids)`);
    }
  }

  return { 
    score: Math.min(100, Math.max(0, finalScore)) / 100,
    reasons 
  };
}

/**
 * Find common cities between two stop arrays
 */
function findCommonCities(stops1: string[], stops2: string[]): string[] {
  const cities1 = stops1.map(stop => extractCityName(stop));
  const cities2 = stops2.map(stop => extractCityName(stop));
  
  return cities1.filter(city => cities2.includes(city));
}

/**
 * Extract city name from stop string (basic implementation)
 */
function extractCityName(stop: string): string {
  // Basic city extraction - could be improved with more sophisticated parsing
  const parts = stop.split(',');
  return parts[0]?.trim() || stop;
}

/**
 * Process a new load and find matching carriers
 */
export async function processNewLoadForMatching(bidNumber: string): Promise<void> {
  try {
    // Get the new load
    const newLoad = await sql`
      SELECT * FROM telegram_bids WHERE bid_number = ${bidNumber}
    `;

    if (newLoad.length === 0) {
      console.log(`Load ${bidNumber} not found`);
      return;
    }

    // Get carriers with notification preferences enabled
    const carriers = await sql`
      SELECT DISTINCT 
        cf.carrier_user_id,
        cnp.similar_load_notifications,
        cnp.distance_threshold_miles,
        cnp.state_preferences,
        cnp.equipment_preferences
      FROM carrier_favorites cf
      JOIN public.carrier_notification_preferences cnp ON cf.carrier_user_id = cnp.carrier_user_id
      WHERE cnp.similar_load_notifications = true
    `;

    for (const carrier of carriers) {
      // Get user's advanced preferences
      const prefsResult = await sql`
        SELECT 
          min_match_score,
          distance_flexibility,
          timing_relevance_days,
          avoid_high_competition,
          max_competition_bids
        FROM public.carrier_notification_preferences
        WHERE carrier_user_id = ${carrier.carrier_user_id}
        LIMIT 1
      `;

      const prefs = prefsResult[0] || {};
      const minMatchScore = (prefs.min_match_score || 70) / 100; // Convert from 0-100 to 0-1

      const criteria: LoadMatchingCriteria = {
        distanceThreshold: carrier.distance_threshold_miles || 50,
        distanceVariancePercent: prefs.distance_flexibility || 25,
        timingRelevanceDays: prefs.timing_relevance_days || 7,
        avoidHighCompetition: prefs.avoid_high_competition || false,
        maxCompetitionBids: prefs.max_competition_bids || 10,
      };

      const similarities = await calculateLoadSimilarity(
        carrier.carrier_user_id,
        newLoad[0] as unknown as TelegramBid,
        criteria
      );

      // Send notifications for matches above user's minimum score threshold
      for (const similarity of similarities) {
        if (similarity.score >= minMatchScore) {
          await createNotification({
            carrierUserId: carrier.carrier_user_id,
            notificationType: 'similar_load',
            title: `Similar Load Alert: ${bidNumber}`,
            message: `New load matches your favorites! Score: ${(similarity.score * 100).toFixed(0)}%. ${similarity.reasons.slice(0, 2).join(', ')}`,
            bidNumber: bidNumber,
            reasons: similarity.reasons,
          });
        }
      }
    }
  } catch (error) {
    console.error('Error processing new load for matching:', error);
  }
}

/**
 * Create a notification record
 */
async function createNotification({
  carrierUserId,
  notificationType,
  title,
  message,
  bidNumber,
  reasons = []
}: {
  carrierUserId: string;
  notificationType: string;
  title: string;
  message: string;
  bidNumber: string;
  reasons?: string[];
}): Promise<void> {
  try {
    await sql`
      INSERT INTO carrier_notifications (
        carrier_user_id,
        type,
        title,
        message,
        bid_number,
        priority
      ) VALUES (
        ${carrierUserId},
        ${notificationType},
        ${title},
        ${message},
        ${bidNumber},
        'medium'
      )
    `;

    console.log(`Notification created for carrier ${carrierUserId}: ${title}`);

    // Send email notification if enabled
    try {
      // Check if user has email notifications enabled
      const prefsResult = await sql`
        SELECT email_notifications FROM public.carrier_notification_preferences
        WHERE carrier_user_id = ${carrierUserId}
        LIMIT 1
      `;

      const emailEnabled = prefsResult[0]?.email_notifications ?? true;

      if (emailEnabled && notificationType === 'similar_load') {
        // Get carrier's email from Clerk
        const userInfo = await getClerkUserInfo(carrierUserId);
        const email = userInfo.emailAddresses?.[0]?.emailAddress;

        if (email) {
          // Extract match score from message (format: "Score: XX%")
          const scoreMatch = message.match(/Score:\s*(\d+)/);
          const matchScore = scoreMatch ? parseInt(scoreMatch[1]) : 0;

          // Generate bid URL
          const bidUrl = process.env.NEXT_PUBLIC_APP_URL 
            ? `${process.env.NEXT_PUBLIC_APP_URL}/bid-board?bid=${bidNumber}`
            : undefined;

          // Send email asynchronously (don't block notification creation)
          sendSimilarLoadNotificationEmail(
            email,
            bidNumber,
            matchScore,
            reasons,
            bidUrl
          ).catch((emailError) => {
            console.error(`Failed to send email to ${email}:`, emailError);
            // Don't throw - email failure shouldn't block notification
          });
        } else {
          console.warn(`No email found for carrier ${carrierUserId}`);
        }
      }
    } catch (emailError) {
      // Log but don't fail notification creation if email fails
      console.error('Error sending email notification:', emailError);
    }
  } catch (error) {
    console.error('Error creating notification:', error);
  }
}

/**
 * Get notification preferences for a carrier
 */
export async function getNotificationPreferences(carrierUserId: string) {
  try {
    const preferences = await sql`
      SELECT * FROM public.carrier_notification_preferences 
      WHERE carrier_user_id = ${carrierUserId}
    `;

    if (preferences.length === 0) {
      // Create default preferences
      await sql`
        INSERT INTO public.carrier_notification_preferences (
          carrier_user_id,
          email_notifications,
          similar_load_notifications,
          distance_threshold_miles,
          state_preferences,
          equipment_preferences,
          min_distance,
          max_distance,
          min_match_score,
          route_match_threshold,
          distance_flexibility,
          timing_relevance_days,
          prioritize_backhaul,
          avoid_high_competition,
          max_competition_bids
        ) VALUES (
          ${carrierUserId},
          true,
          true,
          50,
          ARRAY[]::TEXT[],
          ARRAY[]::TEXT[],
          0,
          2000,
          70,
          60,
          25,
          7,
          true,
          false,
          10
        )
      `;

      return {
        emailNotifications: true,
        similarLoadNotifications: true,
        distanceThresholdMiles: 50,
        statePreferences: [],
        equipmentPreferences: [],
        minDistance: 0,
        maxDistance: 2000,
        minMatchScore: 70,
        routeMatchThreshold: 60,
        distanceFlexibility: 25,
        timingRelevanceDays: 7,
        prioritizeBackhaul: true,
        avoidHighCompetition: false,
        maxCompetitionBids: 10,
      };
    }

    // Map database fields (snake_case) to camelCase
    const pref = preferences[0];
    return {
      emailNotifications: pref.email_notifications ?? true,
      similarLoadNotifications: pref.similar_load_notifications ?? true,
      distanceThresholdMiles: pref.distance_threshold_miles ?? 50,
      statePreferences: pref.state_preferences ?? [],
      equipmentPreferences: pref.equipment_preferences ?? [],
      minDistance: pref.min_distance ?? 0,
      maxDistance: pref.max_distance ?? 2000,
      minMatchScore: pref.min_match_score ?? 70,
      routeMatchThreshold: pref.route_match_threshold ?? 60,
      distanceFlexibility: pref.distance_flexibility ?? 25,
      timingRelevanceDays: pref.timing_relevance_days ?? 7,
      prioritizeBackhaul: pref.prioritize_backhaul ?? true,
      avoidHighCompetition: pref.avoid_high_competition ?? false,
      maxCompetitionBids: pref.max_competition_bids ?? 10,
    };
  } catch (error) {
    console.error('Error getting notification preferences:', error);
    return null;
  }
}

/**
 * Update notification preferences for a carrier
 */
export async function updateNotificationPreferences(
  carrierUserId: string,
  preferences: Partial<{
    emailNotifications: boolean;
    similarLoadNotifications: boolean;
    distanceThresholdMiles: number;
    statePreferences: string[];
    equipmentPreferences: string[];
    minDistance: number;
    maxDistance: number;
    // Advanced fields
    minMatchScore?: number;
    routeMatchThreshold?: number;
    distanceFlexibility?: number;
    timingRelevanceDays?: number;
    prioritizeBackhaul?: boolean;
    avoidHighCompetition?: boolean;
    maxCompetitionBids?: number;
  }>
) {
  try {
    await sql`
      INSERT INTO public.carrier_notification_preferences (
        carrier_user_id,
        email_notifications,
        similar_load_notifications,
        distance_threshold_miles,
        state_preferences,
        equipment_preferences,
        min_distance,
        max_distance,
        min_match_score,
        route_match_threshold,
        distance_flexibility,
        timing_relevance_days,
        prioritize_backhaul,
        avoid_high_competition,
        max_competition_bids
      ) VALUES (
        ${carrierUserId},
        ${preferences.emailNotifications ?? true},
        ${preferences.similarLoadNotifications ?? true},
        ${preferences.distanceThresholdMiles ?? 50},
        ${preferences.statePreferences ?? []},
        ${preferences.equipmentPreferences ?? []},
        ${preferences.minDistance ?? 0},
        ${preferences.maxDistance ?? 2000},
        ${preferences.minMatchScore ?? 70},
        ${preferences.routeMatchThreshold ?? 60},
        ${preferences.distanceFlexibility ?? 25},
        ${preferences.timingRelevanceDays ?? 7},
        ${preferences.prioritizeBackhaul ?? true},
        ${preferences.avoidHighCompetition ?? false},
        ${preferences.maxCompetitionBids ?? 10}
      )
      ON CONFLICT (carrier_user_id)
      DO UPDATE SET
        email_notifications = EXCLUDED.email_notifications,
        similar_load_notifications = EXCLUDED.similar_load_notifications,
        distance_threshold_miles = EXCLUDED.distance_threshold_miles,
        state_preferences = EXCLUDED.state_preferences,
        equipment_preferences = EXCLUDED.equipment_preferences,
        min_distance = EXCLUDED.min_distance,
        max_distance = EXCLUDED.max_distance,
        min_match_score = EXCLUDED.min_match_score,
        route_match_threshold = EXCLUDED.route_match_threshold,
        distance_flexibility = EXCLUDED.distance_flexibility,
        timing_relevance_days = EXCLUDED.timing_relevance_days,
        prioritize_backhaul = EXCLUDED.prioritize_backhaul,
        avoid_high_competition = EXCLUDED.avoid_high_competition,
        max_competition_bids = EXCLUDED.max_competition_bids,
        updated_at = NOW()
    `;

    return { success: true };
  } catch (error: any) {
    console.error('Error updating notification preferences:', error);
    return { success: false, error: error?.message || 'Unknown error' };
  }
}
