/**
 * Cache Invalidation Utilities
 * 
 * Provides functions to clear caches when carrier profiles are updated
 * to ensure data consistency across the application.
 */

import { redisConnection } from "./notification-queue";

/**
 * Clear the leaderboard in-memory cache
 * This ensures that when a carrier profile is updated, the leaderboard
 * will show the new data on the next request instead of waiting for TTL.
 */
export function clearLeaderboardCache(): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g: any = globalThis as any;
    if (g.__leader_cache) {
      g.__leader_cache.clear();
      console.log('[Cache Invalidation] Cleared leaderboard cache');
    }
  } catch (error) {
    console.error('[Cache Invalidation] Error clearing leaderboard cache:', error);
  }
}

/**
 * Clear grouped leaderboard cache
 */
export function clearGroupedLeaderboardCache(): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g: any = globalThis as any;
    if (g.__grouped_leader_cache) {
      g.__grouped_leader_cache.clear();
      console.log('[Cache Invalidation] Cleared grouped leaderboard cache');
    }
  } catch (error) {
    console.error('[Cache Invalidation] Error clearing grouped leaderboard cache:', error);
  }
}

/**
 * Clear all caches related to a specific carrier
 * This is called when a carrier profile is updated
 */
export async function clearCarrierRelatedCaches(carrierUserId?: string): Promise<void> {
  try {
    // Clear individual leaderboard cache
    clearLeaderboardCache();
    
    // Clear grouped leaderboard cache
    clearGroupedLeaderboardCache();
    
    // Clear notification tier cache if userId provided
    if (carrierUserId) {
      try {
        await redisConnection.del(`user_tier:${carrierUserId}`);
        console.log(`[Cache Invalidation] Cleared tier cache for carrier: ${carrierUserId}`);
      } catch (error) {
        console.error('[Cache Invalidation] Error clearing tier cache:', error);
      }
    }
    
    // Log for debugging
    if (carrierUserId) {
      console.log(`[Cache Invalidation] Cleared caches for carrier: ${carrierUserId}`);
    } else {
      console.log('[Cache Invalidation] Cleared all carrier-related caches');
    }
  } catch (error) {
    console.error('[Cache Invalidation] Error clearing carrier caches:', error);
  }
}

