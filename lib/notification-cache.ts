import 'dotenv/config';
import sql from './db';
import { redisConnection } from './notification-queue';

const CACHE_TTL = {
  PREFERENCES: 300, // 5 minutes
  FAVORITES: 180, // 3 minutes
  TRIGGERS: 60, // 1 minute
  ACTIVE_BIDS: 60, // 1 minute
};

// Cache user notification preferences
export async function getCachedPreferences(userId: string) {
  const cacheKey = `prefs:${userId}`;
  const cached = await redisConnection.get(cacheKey);
  
  if (cached) {
    return JSON.parse(cached);
  }
  
  return null;
}

export async function setCachedPreferences(userId: string, preferences: any) {
  const cacheKey = `prefs:${userId}`;
  await redisConnection.setex(cacheKey, CACHE_TTL.PREFERENCES, JSON.stringify(preferences));
}

export async function invalidatePreferencesCache(userId: string) {
  const cacheKey = `prefs:${userId}`;
  await redisConnection.del(cacheKey);
}

// Cache user favorites
export async function getCachedFavorites(userId: string) {
  const cacheKey = `favorites:${userId}`;
  const cached = await redisConnection.get(cacheKey);
  
  if (cached) {
    return JSON.parse(cached);
  }
  
  return null;
}

export async function setCachedFavorites(userId: string, favorites: any[]) {
  const cacheKey = `favorites:${userId}`;
  await redisConnection.setex(cacheKey, CACHE_TTL.FAVORITES, JSON.stringify(favorites));
}

export async function invalidateFavoritesCache(userId: string) {
  const cacheKey = `favorites:${userId}`;
  await redisConnection.del(cacheKey);
}

// Cache active triggers
export async function getCachedTriggers(userId: string) {
  const cacheKey = `triggers:${userId}`;
  const cached = await redisConnection.get(cacheKey);
  
  if (cached) {
    return JSON.parse(cached);
  }
  
  return null;
}

export async function setCachedTriggers(userId: string, triggers: any[]) {
  const cacheKey = `triggers:${userId}`;
  await redisConnection.setex(cacheKey, CACHE_TTL.TRIGGERS, JSON.stringify(triggers));
}

export async function invalidateTriggersCache(userId: string) {
  const cacheKey = `triggers:${userId}`;
  await redisConnection.del(cacheKey);
}

// Rate limiting helper with tiered system for scalability
// Supports 10,000+ subscribers with different limits based on user tier
export async function checkRateLimit(
  userId: string, 
  limit?: number, // Optional override limit
  windowSeconds: number = 3600,
  triggerType?: string // Optional trigger type for per-type limits
): Promise<boolean> {
  // Get user tier from database (cache in Redis for performance)
  const tierCacheKey = `user_tier:${userId}`;
  let userTier = await redisConnection.get(tierCacheKey);
  
  if (!userTier) {
    // Fetch from database and cache for 1 hour
    try {
      const tierResult = await sql`
        SELECT 
          COALESCE(cp.notification_tier, 'standard') as tier
        FROM carrier_profiles cp
        WHERE cp.supabase_user_id = ${userId}
        LIMIT 1
      `;
      
      userTier = tierResult[0]?.tier || 'standard';
      await redisConnection.setex(tierCacheKey, 3600, userTier); // Cache for 1 hour
    } catch (error) {
      console.error(`[RateLimit] Error fetching user tier for ${userId}:`, error);
      userTier = 'standard'; // Default to standard on error
    }
  }
  
  // Determine limit based on tier if not provided
  let effectiveLimit = limit;
  if (!effectiveLimit) {
    switch (userTier) {
      case 'premium':
        effectiveLimit = 200; // 200 notifications per hour
        break;
      case 'standard':
        effectiveLimit = 50; // 50 notifications per hour
        break;
      case 'new':
      default:
        effectiveLimit = 20; // 20 notifications per hour for new users
        break;
    }
  }
  
  // Apply per-trigger-type limits (allows bursts for high-priority triggers)
  if (triggerType) {
    switch (triggerType) {
      case 'exact_match':
      case 'deadline_approaching':
        // High-priority triggers get 2x limit
        effectiveLimit = Math.floor(effectiveLimit * 2);
        break;
      case 'state_match':
        // Medium-priority triggers get 1.5x limit
        effectiveLimit = Math.floor(effectiveLimit * 1.5);
        break;
      case 'state_pref_bid':
      case 'similar_load':
        // Lower-priority triggers use base limit
        break;
    }
  }
  
  // Use sliding window rate limiting for better accuracy
  const cacheKey = `ratelimit:${userId}:${triggerType || 'all'}`;
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  
  // Remove old entries outside the window
  const cutoff = now - windowMs;
  await redisConnection.zremrangebyscore(cacheKey, 0, cutoff);
  
  // Count current entries in window
  const current = await redisConnection.zcard(cacheKey);
  
  if (current < effectiveLimit) {
    // Add current request to sorted set with timestamp as score
    await redisConnection.zadd(cacheKey, now, `${now}-${Math.random()}`);
    // Set expiration on the key
    await redisConnection.expire(cacheKey, windowSeconds);
    return true;
  }
  
  return false;
}

// Batch cache operations
export async function getCachedPreferencesBatch(userIds: string[]): Promise<Map<string, any>> {
  const results = new Map<string, any>();
  const keys = userIds.map(id => `prefs:${id}`);
  
  if (keys.length === 0) return results;
  
  const cached = await redisConnection.mget(...keys);
  
  userIds.forEach((userId, index) => {
    if (cached[index]) {
      try {
        results.set(userId, JSON.parse(cached[index] as string));
      } catch (e) {
        // Invalid JSON, skip
      }
    }
  });
  
  return results;
}

