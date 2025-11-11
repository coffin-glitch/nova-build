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

// Rate limiting helper
export async function checkRateLimit(userId: string, limit: number = 20, windowSeconds: number = 3600): Promise<boolean> {
  const cacheKey = `ratelimit:${userId}`;
  const current = await redisConnection.incr(cacheKey);
  
  if (current === 1) {
    // First request in this window, set expiration
    await redisConnection.expire(cacheKey, windowSeconds);
  }
  
  return current <= limit;
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

