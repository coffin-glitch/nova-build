import { TelegramBid } from "@/lib/auctions";
import sql from "@/lib/db";

interface SimilarityScore {
  carrierUserId: string;
  bidNumber: string;
  score: number;
  reasons: string[];
}

interface LoadMatchingCriteria {
  distanceThreshold: number; // miles
  distanceVariancePercent: number; // percentage
  stateMatchWeight: number;
  distanceMatchWeight: number;
  timingMatchWeight: number;
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
  let score = 0;
  const reasons: string[] = [];

  // 1. State/Tag matching
  if (favoriteLoad.tag && newLoad.tag && favoriteLoad.tag === newLoad.tag) {
    score += criteria.stateMatchWeight;
    reasons.push('Same state/tag');
  }

  // 2. Distance similarity
  if (favoriteLoad.distance_miles && newLoad.distance_miles) {
    const distanceDiff = Math.abs(favoriteLoad.distance_miles - newLoad.distance_miles);
    const distanceVariance = distanceDiff / favoriteLoad.distance_miles;
    
    if (distanceVariance <= criteria.distanceVariancePercent / 100) {
      score += criteria.distanceMatchWeight;
      reasons.push(`Similar distance (${distanceDiff.toFixed(0)} miles difference)`);
    }
  }

  // 3. Route similarity (basic string matching)
  if (favoriteLoad.stops && newLoad.stops) {
    const favoriteStops = Array.isArray(favoriteLoad.stops) ? favoriteLoad.stops : JSON.parse(favoriteLoad.stops || '[]');
    const newStops = Array.isArray(newLoad.stops) ? newLoad.stops : JSON.parse(newLoad.stops || '[]');
    
    const commonCities = findCommonCities(favoriteStops, newStops);
    if (commonCities.length > 0) {
      score += criteria.timingMatchWeight * 0.5; // Partial score for route similarity
      reasons.push(`Common cities: ${commonCities.join(', ')}`);
    }
  }

  // 4. Timing similarity (pickup/delivery windows)
  if (favoriteLoad.pickup_timestamp && newLoad.pickup_timestamp) {
    const favoritePickup = new Date(favoriteLoad.pickup_timestamp);
    const newPickup = new Date(newLoad.pickup_timestamp);
    const timeDiffHours = Math.abs(favoritePickup.getTime() - newPickup.getTime()) / (1000 * 60 * 60);
    
    if (timeDiffHours <= 24) { // Within 24 hours
      score += criteria.timingMatchWeight * 0.5;
      reasons.push(`Similar pickup timing (${timeDiffHours.toFixed(1)} hours apart)`);
    }
  }

  return { score: Math.min(score, 1), reasons };
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
      JOIN carrier_notification_preferences cnp ON cf.carrier_user_id = cnp.carrier_user_id
      WHERE cnp.similar_load_notifications = true
    `;

    for (const carrier of carriers) {
      const criteria: LoadMatchingCriteria = {
        distanceThreshold: carrier.distance_threshold_miles || 50,
        distanceVariancePercent: 20,
        stateMatchWeight: 0.4,
        distanceMatchWeight: 0.3,
        timingMatchWeight: 0.3,
      };

      const similarities = await calculateLoadSimilarity(
        carrier.carrier_user_id,
        newLoad[0],
        criteria
      );

      // Send notifications for high-scoring matches
      for (const similarity of similarities) {
        if (similarity.score > 0.5) {
          await createNotification({
            carrierUserId: carrier.carrier_user_id,
            notificationType: 'similar_load',
            title: `Similar Load Alert: ${bidNumber}`,
            message: `A new load matching your favorites has been posted. Similarity: ${(similarity.score * 100).toFixed(0)}%`,
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
      SELECT * FROM carrier_notification_preferences 
      WHERE carrier_user_id = ${carrierUserId}
    `;

    if (preferences.length === 0) {
      // Create default preferences
      await sql`
        INSERT INTO carrier_notification_preferences (
          carrier_user_id,
          email_notifications,
          similar_load_notifications,
          distance_threshold_miles,
          state_preferences,
          equipment_preferences,
          min_distance,
          max_distance
        ) VALUES (
          ${carrierUserId},
          true,
          true,
          50,
          ARRAY[]::TEXT[],
          ARRAY[]::TEXT[],
          0,
          2000
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
      };
    }

    return preferences[0];
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
  }>
) {
  try {
    await sql`
      INSERT INTO carrier_notification_preferences (
        carrier_user_id,
        email_notifications,
        similar_load_notifications,
        distance_threshold_miles,
        state_preferences,
        equipment_preferences,
        min_distance,
        max_distance
      ) VALUES (
        ${carrierUserId},
        ${preferences.emailNotifications ?? true},
        ${preferences.similarLoadNotifications ?? true},
        ${preferences.distanceThresholdMiles ?? 50},
        ${preferences.statePreferences ?? []},
        ${preferences.equipmentPreferences ?? []},
        ${preferences.minDistance ?? 0},
        ${preferences.maxDistance ?? 2000}
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
        updated_at = NOW()
    `;

    return { success: true };
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    return { success: false, error: error.message };
  }
}
