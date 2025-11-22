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
  if (parsed.city && parsed.state) {
    console.log(`Geocoding API: Using city+state strategy for "${parsed.city}, ${parsed.state}"`);
    const cityStateResult = await geocodeByCityState(parsed.city, parsed.state, token);
    if (cityStateResult) {
      return cityStateResult;
    }
    console.log(`Geocoding API: City+state geocoding failed, trying text search`);
  }
  
  // Strategy 3: Fallback to text search
  console.log(`Geocoding API: Using text search strategy for "${location}"`);
  return await geocodeByText(location, token);
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
      const featureState = (feature.properties?.region_code || feature.properties?.region || '').toUpperCase().trim();
      
      // CRITICAL: If we have expected state, validate the result matches
      // This ensures "85323" (AZ) doesn't return coordinates in another state
      if (expectedState) {
        const expectedStateUpper = expectedState.toUpperCase().trim();
        if (featureState !== expectedStateUpper) {
          console.warn(`Geocoding API: ZIP code "${zip5}" returned state "${featureState}" but expected "${expectedStateUpper}" - rejecting`);
          return null;
        }
      }
      
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
 */
async function geocodeByCityState(
  city: string,
  state: string,
  token: string
): Promise<GeocodeResult | null> {
  try {
    const stateUpper = state.trim().toUpperCase();
    
    const params = new URLSearchParams({
      access_token: token,
      country: 'us',
      place: city.trim(),
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
        const featureState = (f.properties?.region_code || f.properties?.region || '').toUpperCase().trim();
        return featureState === stateUpper;
      });
      
      // Use matching feature if found, otherwise use first result
      const feature = matchingFeature || data.features[0];
      const featureState = (feature.properties?.region_code || feature.properties?.region || '').toUpperCase().trim();
      
      // Validate state matches - if it doesn't, reject the result
      if (featureState !== stateUpper) {
        console.warn(`Geocoding API: Result state "${featureState}" doesn't match expected "${stateUpper}" for "${city}, ${state}" - rejecting`);
        return null;
      }
      
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
 */
async function geocodeByText(
  location: string,
  token: string
): Promise<GeocodeResult | null> {
  try {
    const params = new URLSearchParams({
      access_token: token,
      q: location,
      country: 'us',
      types: 'place,locality,address',
      limit: '1',
    });
    
    const url = `https://api.mapbox.com/search/geocode/v6/forward?${params.toString()}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      console.warn(`Geocoding API: Text search failed with status ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    if (data.features && data.features.length > 0) {
      const feature = data.features[0];
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
 * Simple extraction - no complex parsing
 * CRITICAL: Ensures state is always extracted and validated
 */
function extractLocationComponents(location: string): {
  zipcode?: string;
  city?: string;
  state?: string;
} {
  const trimmed = location.trim();
  
  // Extract ZIP code (5 digits, optionally followed by -4)
  const zipMatch = trimmed.match(/\b(\d{5}(?:-\d{4})?)\b/);
  const zipcode = zipMatch ? zipMatch[1] : undefined;
  
  // Extract state (2 uppercase letters, usually after comma or space)
  // Try multiple patterns to ensure we capture the state
  let state: string | undefined;
  let stateMatch: RegExpMatchArray | null = null;
  
  // Pattern 1: ", ST " or ", ST" (most common: "City, ST ZIPCODE")
  stateMatch = trimmed.match(/,\s*([A-Z]{2})(?:\s|$)/i);
  if (stateMatch) {
    state = stateMatch[1].toUpperCase();
  }
  
  // Pattern 2: " ST " (space before and after state)
  if (!state) {
    stateMatch = trimmed.match(/\s+([A-Z]{2})\s+/i);
    if (stateMatch) {
      state = stateMatch[1].toUpperCase();
    }
  }
  
  // Pattern 3: " ST" at end (before ZIP if present)
  if (!state && zipcode) {
    const beforeZip = trimmed.substring(0, trimmed.indexOf(zipMatch![0])).trim();
    stateMatch = beforeZip.match(/\s+([A-Z]{2})\s*$/i);
    if (stateMatch) {
      state = stateMatch[1].toUpperCase();
    }
  }
  
  // Validate state code (must be valid US state)
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
  
  // Extract city (everything before state, or before ZIP if no state)
  let city: string | undefined;
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
