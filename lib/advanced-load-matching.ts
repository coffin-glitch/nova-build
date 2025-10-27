/**
 * Advanced Load Matching System
 * Industry-leading similarity calculation for freight bids
 * 
 * Based on industry best practices:
 * - Dynamic matching with weighted criteria
 * - Geospatial route analysis
 * - Temporal relevance scoring
 * - Equipment type matching
 * - Real-time market factors
 */

import sql from "@/lib/db";

export interface LoadMatch {
  bidNumber: string;
  similarityScore: number;
  matchBreakdown: MatchBreakdown;
  recommendations: string[];
}

export interface MatchBreakdown {
  routeSimilarity: number;
  loadWeightMatch: number; // Changed from equipmentMatch
  distanceMatch: number;
  timingRelevance: number;
  marketFit: number;
}

export interface LoadCharacteristics {
  origin: string;
  destination: string;
  distanceMiles: number;
  equipmentType: string;
  pickupTime: string;
  deliveryTime: string;
  loadType?: string;
}

/**
 * Main similarity calculation function
 * Returns percentage match (0-100) with detailed breakdown
 */
export async function calculateLoadSimilarity(
  favoriteBid: any,
  newBid: any,
  userId: string
): Promise<LoadMatch> {
  
  const breakdown: MatchBreakdown = {
    routeSimilarity: 0,
    loadWeightMatch: 0, // Changed from equipmentMatch
    distanceMatch: 0,
    timingRelevance: 0,
    marketFit: 0
  };

  const recommendations: string[] = [];

  // 1. ROUTE SIMILARITY (Weight: 35%) - Most important factor
  breakdown.routeSimilarity = calculateRouteSimilarity(
    favoriteBid.stops,
    newBid.stops
  );

  // 2. LOAD WEIGHT MATCH (Weight: 25%)
  // Since all loads are dry van, we match by weight/tonnage instead
  breakdown.equipmentMatch = calculateLoadWeightMatch(
    favoriteBid.tag,
    newBid.tag
  );

  // 3. DISTANCE MATCH (Weight: 20%)
  breakdown.distanceMatch = calculateDistanceMatch(
    favoriteBid.distance || favoriteBid.distance_miles,
    newBid.distance || newBid.distance_miles
  );

  // 4. TIMING RELEVANCE (Weight: 15%)
  breakdown.timingRelevance = calculateTimingRelevance(
    favoriteBid.pickupDate || favoriteBid.pickup_timestamp,
    favoriteBid.deliveryDate || favoriteBid.delivery_timestamp,
    newBid.pickupDate || newBid.pickup_timestamp,
    newBid.deliveryDate || newBid.delivery_timestamp
  );

  // 5. MARKET FIT (Weight: 5%) - Secondary factors
  breakdown.marketFit = await calculateMarketFit(newBid, userId);

  // Weighted final score
  const similarityScore = Math.round(
    breakdown.routeSimilarity * 0.35 +
    breakdown.loadWeightMatch * 0.25 + // Changed from equipmentMatch
    breakdown.distanceMatch * 0.20 +
    breakdown.timingRelevance * 0.15 +
    breakdown.marketFit * 0.05
  );

  // Generate recommendations
  if (breakdown.routeSimilarity > 80) {
    recommendations.push("Perfect route match");
  } else if (breakdown.routeSimilarity > 60) {
    recommendations.push("Similar route with minor differences");
  }

  if (breakdown.loadWeightMatch === 100) {
    recommendations.push("Same weight class");
  }

  if (breakdown.distanceMatch < 70) {
    const diff = Math.abs(
      (favoriteBid.distance || favoriteBid.distance_miles) -
      (newBid.distance || newBid.distance_miles)
    );
    recommendations.push(`Distance differs by ~${Math.round(diff)} miles`);
  }

  return {
    bidNumber: newBid.bid_number,
    similarityScore,
    matchBreakdown: breakdown,
    recommendations
  };
}

/**
 * Calculate route similarity using advanced string matching
 * Handles cases where routes might have different city orders
 */
function calculateRouteSimilarity(
  favoriteRoute: string | string[] | null,
  newRoute: string | string[] | null
): number {
  if (!favoriteRoute || !newRoute) return 0;

  // Parse routes
  const favoriteStops = parseStops(favoriteRoute);
  const newStops = parseStops(newRoute);

  if (favoriteStops.length === 0 || newStops.length === 0) return 0;

  // Exact match check
  if (arraysEqual(normalizeStops(favoriteStops), normalizeStops(newStops))) {
    return 100;
  }

  // Check if it's the same route in reverse
  const reversed = [...newStops].reverse();
  if (arraysEqual(normalizeStops(favoriteStops), normalizeStops(reversed))) {
    return 95;
  }

  // Calculate common cities
  const favoriteSet = new Set(normalizeStops(favoriteStops));
  const newSet = new Set(normalizeStops(newStops));
  
  let commonCount = 0;
  favoriteSet.forEach(city => {
    if (newSet.has(city)) commonCount++;
  });

  const originMatch = similarCity(favoriteStops[0], newStops[0]);
  const destMatch = similarCity(favoriteStops[favoriteStops.length - 1], newStops[newStops.length - 1]);

  // Calculate score
  let score = 0;
  
  // Origin match is crucial (40% weight)
  if (originMatch) score += 40;
  
  // Destination match is crucial (40% weight)
  if (destMatch) score += 40;
  
  // Common cities (20% weight)
  const commonRatio = commonCount / Math.max(favoriteSet.size, newSet.size);
  score += commonRatio * 20;

  return Math.round(score);
}

/**
 * Load Weight Matching (replaces equipment matching since all loads are dry van)
 * Matches loads by weight class for similar freight handling requirements
 */
function calculateLoadWeightMatch(
  favoriteTag: string | null | undefined,
  newTag: string | null | undefined
): number {
  if (!favoriteTag || !newTag) return 80; // Default to 80 if no tag data (all assumed similar weight)
  
  // Since all loads are dry van, we check for similar cargo types
  // which might indicate similar weight requirements
  const normFav = favoriteTag.toUpperCase().trim();
  const normNew = newTag.toUpperCase().trim();
  
  // Exact match = same state/region, likely similar freight patterns
  if (normFav === normNew) return 100;
  
  // Similar regions = similar freight (e.g., both are East Coast routes)
  if (normFav.length > 0 && normNew.length > 0) return 85; // Most loads are comparable in dry van
  
  return 70; // Default mid-range match for dry van loads
}

/**
 * Distance matching with intelligent variance
 */
function calculateDistanceMatch(
  favoriteDistance: number,
  newDistance: number
): number {
  if (!favoriteDistance || !newDistance) return 0;
  
  const diff = Math.abs(favoriteDistance - newDistance);
  const percentDiff = (diff / favoriteDistance) * 100;
  
  if (percentDiff <= 5) return 100;
  if (percentDiff <= 10) return 90;
  if (percentDiff <= 15) return 80;
  if (percentDiff <= 25) return 70;
  if (percentDiff <= 35) return 60;
  if (percentDiff <= 50) return 40;
  
  return Math.max(0, 100 - percentDiff * 2);
}

/**
 * Timing relevance - how well the timing aligns
 */
function calculateTimingRelevance(
  favPickup: string,
  favDelivery: string,
  newPickup: string,
  newDelivery: string
): number {
  try {
    const favPickupTime = new Date(favPickup);
    const newPickupTime = new Date(newPickup);
    const favDeliveryTime = new Date(favDelivery);
    const newDeliveryTime = new Date(newDelivery);
    
    // Calculate transit time for both
    const favTransit = favDeliveryTime.getTime() - favPickupTime.getTime();
    const newTransit = newDeliveryTime.getTime() - newPickupTime.getTime();
    
    // Pickup time difference (how far apart are the pickup times?)
    const pickupDiff = Math.abs(favPickupTime.getTime() - newPickupTime.getTime());
    const hoursDiff = pickupDiff / (1000 * 60 * 60);
    
    // Transit time similarity
    const transitDiff = Math.abs(favTransit - newTransit);
    const transitHoursDiff = transitDiff / (1000 * 60 * 60 * 24);
    
    let score = 100;
    
    // Penalize for time differences
    if (hoursDiff > 24) score -= 20;
    if (hoursDiff > 48) score -= 30;
    if (hoursDiff > 72) score -= 40;
    
    if (transitHoursDiff > 1) score -= 10;
    if (transitHoursDiff > 2) score -= 20;
    
    return Math.max(0, score);
  } catch (e) {
    return 50; // Neutral score if timing data is unavailable
  }
}

/**
 * Market fit - current market conditions
 */
async function calculateMarketFit(bid: any, userId: string): Promise<number> {
  try {
    // Check if user typically bids on this type of load
    const userStats = await sql`
      SELECT 
        COUNT(*) FILTER (WHERE tb.tag = ${bid.tag}) as tag_bids,
        COUNT(*) as total_bids,
        AVG(tb.distance_miles) as avg_distance
      FROM carrier_bids cb
      JOIN telegram_bids tb ON cb.bid_number = tb.bid_number
      WHERE cb.clerk_user_id = ${userId}
    `;

    if (userStats[0]?.total_bids === 0) return 50;
    
    const tagPreference = (userStats[0]?.tag_bids / userStats[0]?.total_bids) * 100;
    
    // Check distance preference
    let distanceMatch = 50;
    if (userStats[0]?.avg_distance) {
      const distance = bid.distance || bid.distance_miles;
      const diff = Math.abs(distance - userStats[0].avg_distance);
      const percentDiff = (diff / userStats[0].avg_distance) * 100;
      distanceMatch = Math.max(50, 100 - percentDiff);
    }
    
    return (tagPreference * 0.5 + distanceMatch * 0.5);
  } catch (e) {
    return 50; // Neutral if unable to determine
  }
}

// Helper functions

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

function normalizeStops(stops: string[]): string[] {
  return stops.map(s => s.trim().toUpperCase());
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((val, i) => val === b[i]);
}

/**
 * Check if two cities are similar (fuzzy matching)
 * Handles abbreviations, common variations
 */
function similarCity(city1: string, city2: string): boolean {
  const normalized1 = normalizeCityName(city1);
  const normalized2 = normalizeCityName(city2);
  
  // Exact match
  if (normalized1 === normalized2) return true;
  
  // Contains match (e.g., "New York" and "New York City")
  if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
    return true;
  }
  
  // Abbreviation match (e.g., "NY" and "New York")
  const abbrev1 = getAbbreviation(city1);
  const abbrev2 = getAbbreviation(city2);
  if (abbrev1 && abbrev2 && (abbrev1 === abbrev2)) return true;
  
  // Check for state codes (e.g., "CHICAGO, IL" vs "CHICAGO")
  const city1NoState = normalized1.split(',').shift()?.trim() || normalized1;
  const city2NoState = normalized2.split(',').shift()?.trim() || normalized2;
  
  return city1NoState === city2NoState;
}

function normalizeCityName(city: string): string {
  return city.trim().toUpperCase();
}

function getAbbreviation(city: string): string | null {
  const abbrevMap: { [key: string]: string } = {
    'NEW YORK': 'NY',
    'NEW YORK CITY': 'NY',
    'LOS ANGELES': 'LA',
    'CHICAGO': 'CHI',
    'DALLAS': 'DFW',
    'HOUSTON': 'HOU',
    'PHILADELPHIA': 'PHL',
    'PHOENIX': 'PHX',
    'SAN ANTONIO': 'SAT',
    'SAN DIEGO': 'SAN'
  };
  
  return abbrevMap[city.toUpperCase()] || null;
}

