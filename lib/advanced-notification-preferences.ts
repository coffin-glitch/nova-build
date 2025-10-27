/**
 * Advanced Notification Preferences System
 * Industry-leading notification filtering based on multi-criteria matching
 */

export interface AdvancedNotificationPreferences {
  // Basic preferences
  emailNotifications: boolean;
  similarLoadNotifications: boolean;
  distanceThresholdMiles: number;
  statePreferences: string[];
  equipmentPreferences: string[];
  minDistance: number;
  maxDistance: number;
  
  // Advanced matching criteria (NEW)
  minMatchScore: number; // Minimum similarity score to trigger (0-100, default: 70)
  routeMatchThreshold: number; // Minimum route similarity percentage (default: 60)
  urgencyStrict: boolean; // Require same pickup urgency level (very-urgent, urgent, soon, normal, flexible)
  distanceFlexibility: number; // Distance variance allowance (0-50%)
  timingRelevanceDays: number; // Days ahead to consider for timing matches
  prioritizeBackhaul: boolean; // Prefer return route matches
  marketPriceAlerts: boolean; // Alert on favorable market prices
  
  // Smart filtering (NEW)
  routeOrigins: string[]; // Preferred origin cities
  routeDestinations: string[]; // Preferred destination cities
  avoidHighCompetition: boolean; // Skip loads with >X bids
  maxCompetitionBids: number; // Maximum acceptable competition
  priceSensitivity: 'low' | 'medium' | 'high'; // How price-sensitive
  
  // Timing preferences (NEW)
  minimumTransitHours: number;
  maximumTransitHours: number;
  preferredPickupDays: string[]; // ['Monday', 'Tuesday', etc.]
  avoidWeekends: boolean;
  
  // Market intelligence (NEW)
  trackMarketTrends: boolean;
  alertOnPriceDrops: boolean; // Alert when market prices drop
  alertOnNewRoutes: boolean; // Alert when new routes appear
  marketBaselinePrice: number; // Baseline for price comparison
}

export const DEFAULT_ADVANCED_PREFERENCES: AdvancedNotificationPreferences = {
  emailNotifications: true,
  similarLoadNotifications: true,
  distanceThresholdMiles: 50,
  statePreferences: [],
  equipmentPreferences: [],
  minDistance: 0,
  maxDistance: 2000,
  
  // Advanced defaults
  minMatchScore: 70,
  routeMatchThreshold: 60,
  urgencyStrict: false,
  distanceFlexibility: 25,
  timingRelevanceDays: 7,
  prioritizeBackhaul: true,
  marketPriceAlerts: true,
  
  // Smart filtering defaults
  routeOrigins: [],
  routeDestinations: [],
  avoidHighCompetition: false,
  maxCompetitionBids: 10,
  priceSensitivity: 'medium',
  
  // Timing defaults
  minimumTransitHours: 0,
  maximumTransitHours: 168,
  preferredPickupDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  avoidWeekends: true,
  
  // Market intelligence defaults
  trackMarketTrends: false,
  alertOnPriceDrops: false,
  alertOnNewRoutes: false,
  marketBaselinePrice: 0,
};

/**
 * Check if a load should trigger a notification based on advanced preferences
 */
export function shouldTriggerNotification(
  load: any,
  preferences: AdvancedNotificationPreferences,
  favoriteMatches: any[]
): {
  shouldNotify: boolean;
  reason: string;
  matchScore?: number;
} {
  // 1. Basic checks
  if (!preferences.similarLoadNotifications) {
    return { shouldNotify: false, reason: 'Similar load notifications disabled' };
  }
  
  if (preferences.emailNotifications === false && preferences.similarLoadNotifications === false) {
    return { shouldNotify: false, reason: 'All notifications disabled' };
  }
  
  // 2. Load Weight filtering (for dry van loads)
  // Since all loads are dry van, we check for similar freight types by state/tag
  if (preferences.equipmentPreferences.length > 0) {
    const loadTag = load.tag?.toUpperCase();
    const matchesWeight = preferences.equipmentPreferences.some(
      pref => loadTag?.includes(pref.toUpperCase())
    );
    
    if (preferences.urgencyStrict && !matchesWeight) {
      return { shouldNotify: false, reason: 'Pickup urgency does not match requirements' };
    }
    
    if (!preferences.urgencyStrict && !matchesWeight) {
      // Partial match allowed
    }
  }
  
  // 3. Distance filtering
  const loadDistance = load.distance || load.distance_miles;
  if (loadDistance < preferences.minDistance) {
    return { shouldNotify: false, reason: `Distance ${loadDistance}mi below minimum ${preferences.minDistance}mi` };
  }
  
  if (loadDistance > preferences.maxDistance) {
    return { shouldNotify: false, reason: `Distance ${loadDistance}mi above maximum ${preferences.maxDistance}mi` };
  }
  
  // 4. Competition filtering
  if (preferences.avoidHighCompetition && load.bids_count > preferences.maxCompetitionBids) {
    return { shouldNotify: false, reason: `Competition too high (${load.bids_count} bids)` };
  }
  
  // 5. Route origin/destination preferences
  if (preferences.routeOrigins.length > 0) {
    const origin = extractOrigin(load.stops);
    const matchesOrigin = preferences.routeOrigins.some(
      pref => similarCity(origin, pref)
    );
    
    if (!matchesOrigin) {
      return { shouldNotify: false, reason: 'Origin does not match preferences' };
    }
  }
  
  if (preferences.routeDestinations.length > 0) {
    const destination = extractDestination(load.stops);
    const matchesDestination = preferences.routeDestinations.some(
      pref => similarCity(destination, pref)
    );
    
    if (!matchesDestination) {
      return { shouldNotify: false, reason: 'Destination does not match preferences' };
    }
  }
  
  // 6. Timing preferences
  if (load.pickup_timestamp || load.pickupDate) {
    const pickupDate = new Date(load.pickup_timestamp || load.pickupDate);
    const dayOfWeek = pickupDate.toLocaleDateString('en-US', { weekday: 'long' });
    
    if (preferences.avoidWeekends && (dayOfWeek === 'Saturday' || dayOfWeek === 'Sunday')) {
      return { shouldNotify: false, reason: 'Weekend pickup detected' };
    }
    
    if (preferences.preferredPickupDays.length > 0) {
      if (!preferences.preferredPickupDays.includes(dayOfWeek)) {
        return { shouldNotify: false, reason: `Pickup on ${dayOfWeek} not in preferred days` };
      }
    }
  }
  
  // 7. Transit time filtering
  if (load.pickup_timestamp && load.delivery_timestamp) {
    const transitTime = (new Date(load.delivery_timestamp).getTime() - new Date(load.pickup_timestamp).getTime()) / (1000 * 60 * 60);
    
    if (transitTime < preferences.minimumTransitHours) {
      return { shouldNotify: false, reason: `Transit time too short (${transitTime.toFixed(1)}h < ${preferences.minimumTransitHours}h)` };
    }
    
    if (transitTime > preferences.maximumTransitHours) {
      return { shouldNotify: false, reason: `Transit time too long (${transitTime.toFixed(1)}h > ${preferences.maximumTransitHours}h)` };
    }
  }
  
  // 8. Favorite matching (highest priority)
  let maxMatchScore = 0;
  let bestMatch = null;
  
  for (const favorite of favoriteMatches) {
    // Calculate match score (simplified for now)
    let matchScore = 0;
    
    // Route match
    const routeMatch = calculateRouteMatch(favorite.stops, load.stops);
    if (routeMatch >= preferences.routeMatchThreshold) {
      matchScore += 40;
    }
    
    // Equipment match
    if (favorite.tag && load.tag && favorite.tag === load.tag) {
      matchScore += 30;
    }
    
    // Distance match
    const distanceMatch = calculateDistanceMatch(favorite.distance, loadDistance, preferences.distanceFlexibility);
    matchScore += distanceMatch * 0.3;
    
    if (matchScore > maxMatchScore) {
      maxMatchScore = matchScore;
      bestMatch = favorite;
    }
  }
  
  // Final decision based on match score
  if (maxMatchScore < preferences.minMatchScore) {
    return { shouldNotify: false, reason: `Match score ${maxMatchScore}% below threshold ${preferences.minMatchScore}%` };
  }
  
  return {
    shouldNotify: true,
    reason: `High match score: ${maxMatchScore}%`,
    matchScore: maxMatchScore
  };
}

// Helper functions

function extractOrigin(stops: string | string[]): string {
  const stopsArray = Array.isArray(stops) ? stops : JSON.parse(stops || '[]');
  return stopsArray[0] || '';
}

function extractDestination(stops: string | string[]): string {
  const stopsArray = Array.isArray(stops) ? stops : JSON.parse(stops || '[]');
  return stopsArray[stopsArray.length - 1] || '';
}

function calculateRouteMatch(favoriteRoute: any, newRoute: any): number {
  const favStops = parseStops(favoriteRoute);
  const newStops = parseStops(newRoute);
  
  if (favStops.length === 0 || newStops.length === 0) return 0;
  
  const favOrigin = favStops[0]?.toUpperCase().trim();
  const favDest = favStops[favStops.length - 1]?.toUpperCase().trim();
  const newOrigin = newStops[0]?.toUpperCase().trim();
  const newDest = newStops[newStops.length - 1]?.toUpperCase().trim();
  
  let score = 0;
  if (favOrigin === newOrigin) score += 50;
  if (favDest === newDest) score += 50;
  
  return score;
}

function calculateDistanceMatch(favoriteDistance: number, newDistance: number, flexibility: number): number {
  if (!favoriteDistance || !newDistance) return 0;
  
  const diff = Math.abs(favoriteDistance - newDistance);
  const percentDiff = (diff / favoriteDistance) * 100;
  
  if (percentDiff <= flexibility / 2) return 100;
  if (percentDiff <= flexibility) return 80;
  if (percentDiff <= flexibility * 1.5) return 60;
  if (percentDiff <= flexibility * 2) return 40;
  
  return Math.max(0, 100 - percentDiff);
}

function parseStops(stops: string | string[]): string[] {
  if (Array.isArray(stops)) return stops;
  if (typeof stops === 'string') {
    try {
      return JSON.parse(stops);
    } catch {
      return [stops];
    }
  }
  return [];
}

function similarCity(city1: string, city2: string): boolean {
  const normalized1 = city1.trim().toUpperCase();
  const normalized2 = city2.trim().toUpperCase();
  
  if (normalized1 === normalized2) return true;
  if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) return true;
  
  // Remove state codes for comparison
  const city1Only = normalized1.split(',')[0].trim();
  const city2Only = normalized2.split(',')[0].trim();
  
  return city1Only === city2Only;
}

