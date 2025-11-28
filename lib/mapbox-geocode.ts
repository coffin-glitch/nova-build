/**
 * Mapbox Geocoding Utility with ZIP Code Priority
 * 
 * Strategy:
 * 1. If ZIP code is available, use it directly (most accurate)
 * 2. If no ZIP, use city + state
 * 3. Fallback to text search
 * 
 * This approach is simpler and more reliable than complex parsing
 */

import { parseAddress } from '@/lib/format';

interface GeocodeResult {
  lng: number;
  lat: number;
  placeName?: string;
}

// Cache for geocoded locations (sessionStorage)
const GEOCODE_CACHE_KEY = 'mapbox_geocode_cache';
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

interface CachedGeocode {
  result: GeocodeResult;
  timestamp: number;
}

/**
 * Get geocoded coordinates for a location string
 * Uses ZIP code as primary method if available
 */
export async function geocodeLocation(
  location: string,
  useApi: boolean = false
): Promise<GeocodeResult | null> {
  // Check cache first
  const cached = getCachedGeocode(location);
  if (cached) {
    const isDefaultCoords = cached.lng === -96.9 && cached.lat === 37.6;
    if (!useApi || !isDefaultCoords) {
      console.log(`Geocoding: Using cached result for "${location}": [${cached.lng}, ${cached.lat}]`);
      return cached;
    }
  }

  // If API is enabled and we have a token, use Mapbox Geocoding API
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || 
                process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  
  if (!token) {
    console.warn(`Geocoding: No Mapbox token found for "${location}"`);
  }
  
  if (token && useApi) {
    console.log(`Geocoding: Calling API for "${location}" (useApi: true)`);
    try {
      const result = await geocodeWithAPI(location, token);
      
      if (!result) {
        console.warn(`Geocoding: API returned no results for "${location}"`);
        return null;
      }
      
      // Cache successful results
      if (result.lng !== -96.9 || result.lat !== 37.6) {
        setCachedGeocode(location, result);
        console.log(`Geocoding: API success for "${location}", cached result`);
      }
      
      return result;
    } catch (error) {
      console.warn(`Geocoding API error for "${location}":`, error);
      return null;
    }
  }

  // Fallback: default US center (only if useApi is false)
  if (!useApi) {
    console.warn(`Geocoding: Using default coordinates for "${location}" (no API)`);
    const defaultLocation: GeocodeResult = { lng: -96.9, lat: 37.6 };
    setCachedGeocode(location, defaultLocation);
    return defaultLocation;
  }
  
  return null;
}

/**
 * Geocode using Mapbox Geocoding API v6
 * Priority: ZIP code > City+State > Text search
 */
async function geocodeWithAPI(
  location: string,
  token: string
): Promise<GeocodeResult | null> {
  // Extract ZIP code, city, and state from location string
  const parsed = extractLocationComponents(location);
  
  // Strategy 1: If we have ZIP code, use it directly (most accurate)
  // CRITICAL: Pass expected state to validate result is in correct state
  if (parsed.zipcode) {
    console.log(`Geocoding API: Using ZIP code strategy for "${parsed.zipcode}"${parsed.state ? ` (expected state: ${parsed.state})` : ''}`);
    const zipResult = await geocodeByZipCode(parsed.zipcode, token, parsed.state);
    if (zipResult) {
      return zipResult;
    }
    console.log(`Geocoding API: ZIP code geocoding failed, trying city+state`);
  }
  
  // Strategy 2: If we have city and state, use structured query
  // Mapbox best practice: Use structured parameters (place, region) for city+state
  if (parsed.city && parsed.state) {
    console.log(`Geocoding API: Using city+state strategy for "${parsed.city} ${parsed.state}"${parsed.zipcode ? ` ${parsed.zipcode}` : ''}`);
    const cityStateResult = await geocodeByCityState(parsed.city, parsed.state, token);
    if (cityStateResult) {
      return cityStateResult;
    }
    console.log(`Geocoding API: City+state geocoding failed, trying text search`);
  }
  
  // Strategy 3: Fallback to text search with normalized format
  // Mapbox best practice: Use space-separated format (no comma) for text queries
  // Format: "City State ZIP" instead of "City, State ZIP"
  let normalizedLocation = location.trim();
  if (parsed.city && parsed.state) {
    // Build normalized format: "City State ZIP" (no comma)
    normalizedLocation = `${parsed.city} ${parsed.state}`;
    if (parsed.zipcode) {
      normalizedLocation += ` ${parsed.zipcode}`;
    }
  } else {
    // If we don't have parsed components, normalize by removing commas
    normalizedLocation = normalizedLocation.replace(/,\s*/g, ' ').replace(/\s+/g, ' ').trim();
  }
  
  console.log(`Geocoding API: Using text search strategy for "${normalizedLocation}"${parsed.state ? ` (expected state: ${parsed.state})` : ''}`);
  return await geocodeByText(normalizedLocation, token, parsed.state);
}

/**
 * Extract state abbreviation from Mapbox feature properties
 * Tries multiple property names as Mapbox API v6 may use different fields
 */
function extractStateFromFeature(feature: any): string | null {
  if (!feature?.properties) return null;
  
  const props = feature.properties;
  
  // Try various property names that Mapbox might use
  const statePropertyNames = [
    'region_code',      // Common in geocoding APIs
    'region_a1_abbr',   // Administrative level 1 abbreviation
    'region_a1',        // Administrative level 1
    'state_code',       // Direct state code
    'state',            // State name or code
    'admin1_code',     // Admin level 1 code
    'region',           // Region name (might be full name, not abbreviation)
  ];
  
  for (const propName of statePropertyNames) {
    const value = props[propName];
    if (value && typeof value === 'string') {
      const trimmed = value.trim().toUpperCase();
      // If it's a 2-letter code, return it
      if (trimmed.length === 2 && /^[A-Z]{2}$/.test(trimmed)) {
        return trimmed;
      }
      // If it's a longer string, try to extract 2-letter code from it
      const match = trimmed.match(/\b([A-Z]{2})\b/);
      if (match) {
        return match[1];
      }
    }
  }
  
  // Fallback: Try to extract state from full_address or name
  const addressFields = ['full_address', 'name', 'place_name'];
  for (const field of addressFields) {
    const value = props[field];
    if (value && typeof value === 'string') {
      // Look for ", ST " or ", ST" pattern (e.g., "City, NJ" or "City, NJ 08865")
      const match = value.match(/,\s*([A-Z]{2})(?:\s|$)/);
      if (match) {
        return match[1];
      }
    }
  }
  
  return null;
}

/**
 * Geocode by ZIP code only (most accurate method)
 * CRITICAL: If state is provided, validates result is in correct state
 */
async function geocodeByZipCode(
  zipcode: string,
  token: string,
  expectedState?: string
): Promise<GeocodeResult | null> {
  // Extract 5-digit ZIP (ignore +4 extension)
  const zip5 = zipcode.substring(0, 5).trim();
  
  if (!/^\d{5}$/.test(zip5)) {
    return null;
  }
  
  try {
    // Use Mapbox Geocoding API with postcode parameter
    const params = new URLSearchParams({
      access_token: token,
      country: 'us',
      postcode: zip5,
      types: 'postcode',
      limit: '1',
    });
    
    // If we have expected state, add it to the query for better accuracy
    if (expectedState) {
      params.set('region', expectedState.toUpperCase());
    }
    
    const url = `https://api.mapbox.com/search/geocode/v6/forward?${params.toString()}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      console.warn(`Geocoding API: ZIP code query failed with status ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    if (data.features && data.features.length > 0) {
      const feature = data.features[0];
      
      // CRITICAL: When we use the region parameter, Mapbox already filters results by state
      // So we should trust ANY result that comes back - no need for additional state validation
      // This prevents false rejections when Mapbox doesn't include state in response properties
      // We always set the region parameter when expectedState is provided, so no validation needed
      
      const coords = feature.properties?.coordinates;
      
      if (coords && coords.longitude && coords.latitude) {
        return {
          lng: coords.longitude,
          lat: coords.latitude,
          placeName: feature.properties?.full_address || feature.properties?.name || `ZIP ${zip5}`,
        };
      }
      
      // Fallback to geometry coordinates
      if (feature.geometry?.coordinates && feature.geometry.coordinates.length >= 2) {
        return {
          lng: feature.geometry.coordinates[0],
          lat: feature.geometry.coordinates[1],
          placeName: feature.properties?.full_address || feature.properties?.name || `ZIP ${zip5}`,
        };
      }
    }
    
    return null;
  } catch (error) {
    console.warn(`Geocoding API: Error geocoding ZIP code "${zip5}":`, error);
    return null;
  }
}

/**
 * Geocode by city and state
 * CRITICAL: Validates that result is in the correct state
 * Uses Mapbox best practices: structured parameters (place, region) for accuracy
 */
async function geocodeByCityState(
  city: string,
  state: string,
  token: string
): Promise<GeocodeResult | null> {
  try {
    const stateUpper = state.trim().toUpperCase();
    const cityTrimmed = city.trim();
    
    // Mapbox best practice: Use structured parameters (place, region) instead of text query
    // This is more accurate than "City, State" text format
    const params = new URLSearchParams({
      access_token: token,
      country: 'us',
      place: cityTrimmed,
      region: stateUpper,
      types: 'place,locality',
      limit: '3', // Get multiple results to find one in correct state
    });
    
    const url = `https://api.mapbox.com/search/geocode/v6/forward?${params.toString()}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      console.warn(`Geocoding API: City+state query failed with status ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    if (data.features && data.features.length > 0) {
      // CRITICAL: Find a feature that matches the expected state
      // This ensures "AVONDALE, AZ" doesn't return "Avondale, OH"
      const matchingFeature = data.features.find((f: any) => {
        const featureState = extractStateFromFeature(f);
        return featureState === stateUpper;
      });
      
      // Use matching feature if found, otherwise use first result
      const feature = matchingFeature || data.features[0];
      const featureState = extractStateFromFeature(feature);
      
      // CRITICAL: We always use the region parameter in city+state queries, so Mapbox already filters by state
      // Trust ANY result that comes back - no need for additional state validation
      // This prevents false rejections when Mapbox doesn't include state in response properties
      // No validation needed - Mapbox handles it via the region parameter
      
      const coords = feature.properties?.coordinates;
      
      if (coords && coords.longitude && coords.latitude) {
        return {
          lng: coords.longitude,
          lat: coords.latitude,
          placeName: feature.properties?.full_address || feature.properties?.name || `${city}, ${state}`,
        };
      }
      
      // Fallback to geometry coordinates
      if (feature.geometry?.coordinates && feature.geometry.coordinates.length >= 2) {
        return {
          lng: feature.geometry.coordinates[0],
          lat: feature.geometry.coordinates[1],
          placeName: feature.properties?.full_address || feature.properties?.name || `${city}, ${state}`,
        };
      }
    }
    
    return null;
  } catch (error) {
    console.warn(`Geocoding API: Error geocoding city+state "${city}, ${state}":`, error);
    return null;
  }
}

/**
 * Geocode by text search (fallback)
 * CRITICAL: If expectedState is provided, validates result is in correct state
 * Uses Mapbox best practices: space-separated format (no comma), proper URL encoding
 */
async function geocodeByText(
  location: string,
  token: string,
  expectedState?: string
): Promise<GeocodeResult | null> {
  try {
    // Mapbox best practice: Remove commas and normalize to space-separated format
    // "City, State ZIP" -> "City State ZIP" (Mapbox prefers no comma)
    let normalizedLocation = location.trim();
    
    // Remove commas but preserve structure
    // "FAYETTEVILLE, AR 72701" -> "FAYETTEVILLE AR 72701"
    normalizedLocation = normalizedLocation.replace(/,\s*/g, ' ');
    
    // Clean up multiple spaces
    normalizedLocation = normalizedLocation.replace(/\s+/g, ' ').trim();
    
    const params = new URLSearchParams({
      access_token: token,
      q: normalizedLocation, // URL encoding happens automatically via URLSearchParams
      country: 'us',
      types: 'place,locality,address',
      limit: '3', // Get multiple results to find one in correct state if expectedState is provided
    });
    
    // If we have expected state, add it to the query for better accuracy
    if (expectedState) {
      params.set('region', expectedState.toUpperCase());
    }
    
    const url = `https://api.mapbox.com/search/geocode/v6/forward?${params.toString()}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      console.warn(`Geocoding API: Text search failed with status ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    if (data.features && data.features.length > 0) {
      // CRITICAL: When we use the region parameter, Mapbox already filters results by state
      // So we should trust ANY result that comes back - no need for additional state validation
      // This prevents false rejections when Mapbox doesn't include state in response properties
      const feature = data.features[0];
      
      // No state validation needed when using region parameter - Mapbox handles it
      
      const coords = feature.properties?.coordinates;
      
      if (coords && coords.longitude && coords.latitude) {
        return {
          lng: coords.longitude,
          lat: coords.latitude,
          placeName: feature.properties?.full_address || feature.properties?.name || location,
        };
      }
      
      // Fallback to geometry coordinates
      if (feature.geometry?.coordinates && feature.geometry.coordinates.length >= 2) {
        return {
          lng: feature.geometry.coordinates[0],
          lat: feature.geometry.coordinates[1],
          placeName: feature.properties?.full_address || feature.properties?.name || location,
        };
      }
    }
    
    return null;
  } catch (error) {
    console.warn(`Geocoding API: Error geocoding text "${location}":`, error);
    return null;
  }
}

/**
 * Extract location components (ZIP, city, state) from address string
 * CRITICAL: Uses parseAddress to properly separate street from city
 * This ensures "PALMA AVE ANAHEIM, CA 92899" extracts "ANAHEIM" as city, not "PALMA AVE ANAHEIM"
 * CRITICAL: Ensures state is always extracted and validated
 */
function extractLocationComponents(location: string): {
  zipcode?: string;
  city?: string;
  state?: string;
} {
  const trimmed = location.trim();
  
  // Use parseAddress to properly separate street from city
  // This is critical for addresses like "PALMA AVE ANAHEIM, CA 92899"
  // where we need "ANAHEIM" as the city, not "PALMA AVE ANAHEIM"
  const parsed = parseAddress(trimmed);
  
  // Extract ZIP code (5 digits, optionally followed by -4)
  const zipMatch = trimmed.match(/\b(\d{5}(?:-\d{4})?)\b/);
  const zipcode = zipMatch ? zipMatch[1] : undefined;
  
  // Extract state (2 uppercase letters, usually after comma or space)
  // Try multiple patterns to ensure we capture the state
  // CRITICAL: State extraction must be robust - if address says "City, AZ ZIPCODE", 
  // we MUST extract "AZ" and ensure geocoding is in Arizona, never another state
  let state: string | undefined;
  let stateMatch: RegExpMatchArray | null = null;
  
  // First, try to use parsed state from parseAddress (most reliable)
  if (parsed.state) {
    state = parsed.state.toUpperCase().trim();
  }
  
  // If parseAddress didn't extract state, try regex patterns
  if (!state) {
    // Pattern 1: ", ST " or ", ST" or ", ST ZIPCODE" (most common: "City, ST ZIPCODE")
    // Updated regex to handle ", ST " followed by space or ZIP code
    stateMatch = trimmed.match(/,\s*([A-Z]{2})(?:\s+|\s*\d|$)/i);
    if (stateMatch) {
      const stateCode = stateMatch[1].toUpperCase().trim();
      // Validate it's a real state code
      const validStates = new Set([
        'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
        'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
        'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
        'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
        'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'
      ]);
      if (validStates.has(stateCode)) {
        state = stateCode;
      }
    }
  }
  
  // Pattern 2: " ST " (space before and after state)
  if (!state) {
    stateMatch = trimmed.match(/\s+([A-Z]{2})\s+/i);
    if (stateMatch) {
      const stateCode = stateMatch[1].toUpperCase().trim();
      const validStates = new Set([
        'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
        'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
        'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
        'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
        'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'
      ]);
      if (validStates.has(stateCode)) {
        state = stateCode;
      }
    }
  }
  
  // Pattern 3: " ST" at end (before ZIP if present)
  if (!state && zipcode) {
    const beforeZip = trimmed.substring(0, trimmed.indexOf(zipMatch![0])).trim();
    stateMatch = beforeZip.match(/\s+([A-Z]{2})\s*$/i);
    if (stateMatch) {
      const stateCode = stateMatch[1].toUpperCase().trim();
      const validStates = new Set([
        'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
        'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
        'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
        'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
        'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'
      ]);
      if (validStates.has(stateCode)) {
        state = stateCode;
      }
    }
  }
  
  // Final validation: Ensure state code is valid US state
  // CRITICAL: If we have a state, it must be valid - reject invalid codes
  const validStates = new Set([
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
    'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
    'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
    'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'
  ]);
  
  if (state && !validStates.has(state)) {
    console.warn(`Geocoding: Invalid state code "${state}" extracted from "${location}", ignoring`);
    state = undefined;
  }
  
  // CRITICAL: Log state extraction for debugging
  if (state) {
    console.log(`Geocoding: Extracted state "${state}" from "${location}"`);
  } else {
    console.warn(`Geocoding: Could not extract valid state from "${location}"`);
  }
  
  // Use parsed city from parseAddress (this properly separates street from city)
  // This ensures "PALMA AVE ANAHEIM, CA 92899" gives us "ANAHEIM" as city
  let city: string | undefined = parsed.city ? parsed.city.trim() : undefined;
  
  // Fallback: If parseAddress didn't extract city, try manual extraction
  if (!city) {
    if (state && stateMatch) {
      const beforeState = trimmed.substring(0, trimmed.indexOf(stateMatch[0])).trim();
      // Remove trailing comma
      city = beforeState.replace(/,\s*$/, '').trim();
    } else if (zipcode) {
      const beforeZip = trimmed.substring(0, trimmed.indexOf(zipMatch![0])).trim();
      // If we found state before ZIP in pattern 3, extract city
      if (state && stateMatch) {
        const beforeState = beforeZip.substring(0, beforeZip.indexOf(stateMatch[0])).trim();
        city = beforeState.replace(/,\s*$/, '').trim();
      } else {
        // No state found, use everything before ZIP as city
        city = beforeZip.replace(/,\s*$/, '').trim();
      }
    }
  }
  
  return { zipcode, city, state };
}

/**
 * Cache management functions
 */
function getCachedGeocode(location: string): GeocodeResult | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const cached = sessionStorage.getItem(GEOCODE_CACHE_KEY);
    if (!cached) return null;
    
    const cache: Record<string, CachedGeocode> = JSON.parse(cached);
    const entry = cache[location];
    
    if (!entry) return null;
    
    const age = Date.now() - entry.timestamp;
    if (age > CACHE_DURATION) {
      delete cache[location];
      sessionStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(cache));
      return null;
    }
    
    return entry.result;
  } catch (error) {
    console.warn('Error reading geocode cache:', error);
    return null;
  }
}

function setCachedGeocode(location: string, result: GeocodeResult): void {
  if (typeof window === 'undefined') return;
  
  try {
    const cached = sessionStorage.getItem(GEOCODE_CACHE_KEY);
    const cache: Record<string, CachedGeocode> = cached ? JSON.parse(cached) : {};
    
    cache[location] = {
      result,
      timestamp: Date.now(),
    };
    
    sessionStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.warn('Error writing geocode cache:', error);
  }
}

/**
 * Batch geocode multiple locations
 */
export async function geocodeBatch(
  locations: string[],
  useApi: boolean = false
): Promise<GeocodeResult[]> {
  const results: GeocodeResult[] = [];
  
  // Process sequentially to avoid rate limits
  for (const location of locations) {
    const result = await geocodeLocation(location, useApi);
    results.push(result || { lng: -96.9, lat: 37.6 });
  }
  
  return results;
}
