/**
 * Cache Management System
 * Prevents development cache issues by providing automatic cache clearing
 */

interface CacheEntry {
  data: any;
  timestamp: number;
  key: string;
}

class CacheManager {
  private caches = new Map<string, Map<string, CacheEntry>>();
  private clearInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Auto-clear caches every 5 minutes in development
    if (process.env.NODE_ENV === 'development') {
      this.startAutoClear();
    }
  }

  /**
   * Register a cache for management
   */
  registerCache(name: string, cache: Map<string, any>) {
    this.caches.set(name, cache);
    console.log(`📦 Registered cache: ${name}`);
  }

  /**
   * Clear all registered caches
   */
  clearAllCaches() {
    let clearedCount = 0;
    for (const [name, cache] of this.caches) {
      cache.clear();
      clearedCount++;
      console.log(`🧹 Cleared cache: ${name}`);
    }
    console.log(`✅ Cleared ${clearedCount} caches`);
    return clearedCount;
  }

  /**
   * Clear a specific cache
   */
  clearCache(name: string) {
    const cache = this.caches.get(name);
    if (cache) {
      cache.clear();
      console.log(`🧹 Cleared cache: ${name}`);
      return true;
    }
    console.log(`⚠️ Cache not found: ${name}`);
    return false;
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    const stats: Record<string, { size: number; keys: string[] }> = {};
    for (const [name, cache] of this.caches) {
      stats[name] = {
        size: cache.size,
        keys: Array.from(cache.keys())
      };
    }
    return stats;
  }

  /**
   * Start automatic cache clearing in development
   */
  private startAutoClear() {
    if (this.clearInterval) return;

    this.clearInterval = setInterval(() => {
      const now = Date.now();
      let clearedCount = 0;

      for (const [name, cache] of this.caches) {
        const entriesToDelete: string[] = [];
        
        for (const [key, entry] of cache) {
          // Clear entries older than 5 minutes
          if (now - entry.timestamp > 5 * 60 * 1000) {
            entriesToDelete.push(key);
          }
        }

        entriesToDelete.forEach(key => cache.delete(key));
        if (entriesToDelete.length > 0) {
          clearedCount += entriesToDelete.length;
        }
      }

      if (clearedCount > 0) {
        console.log(`🔄 Auto-cleared ${clearedCount} stale cache entries`);
      }
    }, 5 * 60 * 1000); // Every 5 minutes

    console.log("🔄 Started automatic cache clearing");
  }

  /**
   * Stop automatic cache clearing
   */
  stopAutoClear() {
    if (this.clearInterval) {
      clearInterval(this.clearInterval);
      this.clearInterval = null;
      console.log("⏹️ Stopped automatic cache clearing");
    }
  }

  /**
   * Force clear all caches and restart auto-clear
   */
  forceRefresh() {
    this.clearAllCaches();
    this.stopAutoClear();
    this.startAutoClear();
    console.log("🔄 Force refreshed all caches");
  }
}

// Global cache manager instance
export const cacheManager = new CacheManager();

// Development helper functions
export const devCacheHelpers = {
  clearAll: () => cacheManager.clearAllCaches(),
  clearCache: (name: string) => cacheManager.clearCache(name),
  getStats: () => cacheManager.getCacheStats(),
  forceRefresh: () => cacheManager.forceRefresh(),
  registerCache: (name: string, cache: Map<string, any>) => cacheManager.registerCache(name, cache)
};

// Make helpers available globally in development
if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
  (window as any).cacheHelpers = devCacheHelpers;
  console.log("🛠️ Cache helpers available at window.cacheHelpers");
}
