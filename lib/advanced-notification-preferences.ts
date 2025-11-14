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
 * Check if a bid should trigger a notification based on advanced preferences
 * Note: This system works with bids (telegram_bids), not loads
 */
export function shouldTriggerNotification(
  bid: any, // Bid from telegram_bids table (not a load)
  preferences: AdvancedNotificationPreferences,
  favoriteMatches: any[]
): {
  shouldNotify: boolean;
  reason: string;
  matchScore?: number;
  scoreBreakdown?: {
    routeScore: number;
    distanceScore: number;
    totalScore: number;
  };
} {
  // 1. Basic checks
  if (!preferences.similarLoadNotifications) {
    return { shouldNotify: false, reason: 'Similar load notifications disabled' };
  }
  
  if (!preferences.emailNotifications && !preferences.similarLoadNotifications) {
    return { shouldNotify: false, reason: 'All notifications disabled' };
  }
  
  // 2. Bid tag filtering (for bid urgency/preference matching)
  // Since all bids use the same equipment, we check for bid tag preferences
  if (preferences.equipmentPreferences.length > 0) {
    const bidTag = bid.tag?.toUpperCase(); // tag from telegram_bids table
    const matchesTag = preferences.equipmentPreferences.some(
      pref => bidTag?.includes(pref.toUpperCase())
    );
    
    if (preferences.urgencyStrict && !matchesTag) {
      return { shouldNotify: false, reason: 'Bid tag does not match requirements' };
    }
    
    if (!preferences.urgencyStrict && !matchesTag) {
      // Partial match allowed
    }
  }
  
  // 3. Distance filtering
  const bidDistance = bid.distance || bid.distance_miles;
  if (bidDistance < preferences.minDistance) {
    return { shouldNotify: false, reason: `Distance ${bidDistance}mi below minimum ${preferences.minDistance}mi` };
  }
  
  if (bidDistance > preferences.maxDistance) {
    return { shouldNotify: false, reason: `Distance ${bidDistance}mi above maximum ${preferences.maxDistance}mi` };
  }
  
  // 4. Competition filtering
  if (preferences.avoidHighCompetition && bid.bids_count > preferences.maxCompetitionBids) {
    return { shouldNotify: false, reason: `Competition too high (${bid.bids_count} bids)` };
  }
  
  // 5. Route origin/destination preferences
  if (preferences.routeOrigins.length > 0) {
    const origin = extractOrigin(bid.stops);
    const matchesOrigin = preferences.routeOrigins.some(
      pref => similarCity(origin, pref)
    );
    
    if (!matchesOrigin) {
      return { shouldNotify: false, reason: 'Origin does not match preferences' };
    }
  }
  
  if (preferences.routeDestinations.length > 0) {
    const destination = extractDestination(bid.stops);
    const matchesDestination = preferences.routeDestinations.some(
      pref => similarCity(destination, pref)
    );
    
    if (!matchesDestination) {
      return { shouldNotify: false, reason: 'Destination does not match preferences' };
    }
  }
  
  // 6. Timing preferences
  // Check timing relevance window if enabled
  const useTimingRelevance = (preferences as any).useTimingRelevance !== false; // Default to true for backward compatibility
  if (useTimingRelevance && (bid.pickup_timestamp || bid.pickupDate)) {
    const pickupDate = new Date(bid.pickup_timestamp || bid.pickupDate);
    const now = new Date();
    const daysUntilPickup = (pickupDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    const relevanceWindow = preferences.timingRelevanceDays || 7;
    
    // Check if pickup is within the relevance window
    if (daysUntilPickup < 0) {
      return { shouldNotify: false, reason: 'Pickup time has passed' };
    }
    
    if (daysUntilPickup > relevanceWindow) {
      return { shouldNotify: false, reason: `Pickup is ${daysUntilPickup.toFixed(1)} days away, beyond ${relevanceWindow} day window` };
    }
    
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
  if (bid.pickup_timestamp && bid.delivery_timestamp) {
    const transitTime = (new Date(bid.delivery_timestamp).getTime() - new Date(bid.pickup_timestamp).getTime()) / (1000 * 60 * 60);
    
    if (transitTime < preferences.minimumTransitHours) {
      return { shouldNotify: false, reason: `Transit time too short (${transitTime.toFixed(1)}h < ${preferences.minimumTransitHours}h)` };
    }
    
    if (transitTime > preferences.maximumTransitHours) {
      return { shouldNotify: false, reason: `Transit time too long (${transitTime.toFixed(1)}h > ${preferences.maximumTransitHours}h)` };
    }
  }
  
  // 8. Favorite matching (highest priority) with detailed scoring breakdown
  // Note: All bids use the same equipment, so equipment score is not included
  let maxMatchScore = 0;
  let bestMatch = null;
  let scoreBreakdown: {
    routeScore: number;
    distanceScore: number;
    totalScore: number;
  } | null = null;
  
  for (const favorite of favoriteMatches) {
    // Calculate detailed match score breakdown
    let matchScore = 0;
    let routeScore = 0;
    let distanceScore = 0;
    
    // Route match (includes backhaul if enabled) - 50 points max
    const routeMatch = calculateRouteMatch(favorite.stops, bid.stops, preferences.prioritizeBackhaul);
    if (routeMatch >= preferences.routeMatchThreshold) {
      routeScore = Math.min(50, routeMatch * 0.5); // Scale to 50 points
      matchScore += routeScore;
    }
    
    // Distance match - 50 points max (equipment removed since all bids use same equipment)
    const distanceMatch = calculateDistanceMatch(favorite.distance, bidDistance, preferences.distanceFlexibility);
    distanceScore = distanceMatch * 0.5; // Scale to 50 points
    matchScore += distanceScore;
    
    if (matchScore > maxMatchScore) {
      maxMatchScore = matchScore;
      bestMatch = favorite;
      scoreBreakdown = {
        routeScore: Math.round(routeScore),
        distanceScore: Math.round(distanceScore),
        totalScore: Math.round(matchScore)
      };
    }
  }
  
  // Final decision based on match score (only if filtering is enabled)
  // Note: useMinMatchScoreFilter is not in AdvancedNotificationPreferences interface yet,
  // but we check it if available. For now, default to true for backward compatibility.
  const useMinMatchScoreFilter = (preferences as any).useMinMatchScoreFilter !== false;
  if (useMinMatchScoreFilter && maxMatchScore < preferences.minMatchScore) {
    return { shouldNotify: false, reason: `Match score ${maxMatchScore}% below threshold ${preferences.minMatchScore}%` };
  }
  
  return {
    shouldNotify: true,
    reason: `High match score: ${maxMatchScore}%${scoreBreakdown ? ` (Route: ${scoreBreakdown.routeScore}pts, Distance: ${scoreBreakdown.distanceScore}pts)` : ''}`,
    matchScore: maxMatchScore,
    scoreBreakdown: scoreBreakdown || undefined
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

function calculateRouteMatch(favoriteRoute: any, newRoute: any, prioritizeBackhaul: boolean = false): number {
  const favStops = parseStops(favoriteRoute);
  const newStops = parseStops(newRoute);
  
  if (favStops.length === 0 || newStops.length === 0) return 0;
  
  const favOrigin = favStops[0]?.toUpperCase().trim();
  const favDest = favStops[favStops.length - 1]?.toUpperCase().trim();
  const newOrigin = newStops[0]?.toUpperCase().trim();
  const newDest = newStops[newStops.length - 1]?.toUpperCase().trim();
  
  // Exact match (forward route)
  let score = 0;
  if (favOrigin === newOrigin) score += 50;
  if (favDest === newDest) score += 50;
  
  // Backhaul match (reverse route) - if enabled
  if (prioritizeBackhaul) {
    let backhaulScore = 0;
    if (favOrigin === newDest) backhaulScore += 50; // Favorite origin matches new destination
    if (favDest === newOrigin) backhaulScore += 50; // Favorite destination matches new origin
    
    // Return the higher score (exact or backhaul)
    if (backhaulScore > score) {
      return backhaulScore;
    }
  }
  
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

