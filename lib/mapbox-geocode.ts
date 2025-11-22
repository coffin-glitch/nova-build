/**
 * Mapbox Geocoding Utility with Caching
 * 
 * This utility provides cost-effective geocoding by:
 * 1. Caching results in sessionStorage (reduces API calls)
 * 2. Using batch requests when possible
 * 3. Falling back to approximations for common locations
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
 * Uses caching to minimize API calls
 */
export async function geocodeLocation(
  location: string,
  useApi: boolean = false
): Promise<GeocodeResult | null> {
  // Check cache first (but skip if useApi is true and cached value is default coordinates)
  const cached = getCachedGeocode(location);
  if (cached) {
    // If useApi is true, don't trust cached default coordinates (they might be from failed attempts)
    const isDefaultCoords = cached.lng === -96.9 && cached.lat === 37.6;
    if (!useApi || !isDefaultCoords) {
      console.log(`Geocoding: Using cached result for "${location}": [${cached.lng}, ${cached.lat}]`);
      return cached;
    } else {
      console.log(`Geocoding: Skipping cached default coordinates for "${location}", will use API`);
    }
  }

  // Try to extract approximate coordinates from common patterns
  const approximate = getApproximateLocation(location);
  if (approximate && !useApi) {
    // Cache the approximation
    setCachedGeocode(location, approximate);
    return approximate;
  }

  // If API is enabled and we have a token, use Mapbox Geocoding API
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || 
                process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  
  if (!token) {
    console.warn(`Geocoding: No Mapbox token found for "${location}"`);
  }
  
  if (token && useApi) {
    console.log(`Geocoding: Calling API for "${location}" (useApi: true, token: ${token.substring(0, 10)}...)`);
    try {
      const result = await geocodeWithAPI(location, token);
      
      // Handle null result (no results found)
      if (!result) {
        console.warn(`Geocoding: API returned no results for "${location}", trying fallback`);
        // Fall back to approximation
        const fallback = getApproximateLocation(location);
        if (fallback) {
          console.log(`Geocoding: Using approximation for "${location}"`);
          setCachedGeocode(location, fallback);
          return fallback;
        }
        // If no approximation, return default (but don't cache it)
        console.warn(`Geocoding: No results and no approximation for "${location}", returning null`);
        return null as any; // Return null to indicate failure
      }
      
      // Only cache if we got real coordinates (not default)
      if (result.lng !== -96.9 || result.lat !== 37.6) {
        setCachedGeocode(location, result);
        console.log(`Geocoding: API success for "${location}", cached result`);
      } else {
        console.warn(`Geocoding: API returned default coordinates for "${location}", trying fallback`);
        // Try approximation as fallback
        const fallback = getApproximateLocation(location);
        if (fallback && (fallback.lng !== -96.9 || fallback.lat !== 37.6)) {
          console.log(`Geocoding: Using approximation for "${location}"`);
          setCachedGeocode(location, fallback);
          return fallback;
        }
      }
      return result;
    } catch (error) {
      console.warn(`Geocoding API error for "${location}":`, error);
      // Fall back to approximation
      const fallback = getApproximateLocation(location);
      if (fallback) {
        console.log(`Geocoding: Using approximation for "${location}"`);
        setCachedGeocode(location, fallback);
        return fallback;
      }
      // If no approximation, return null instead of throwing
      console.warn(`Geocoding: No fallback available for "${location}"`);
      return null as any;
    }
  }

  // Final fallback: default US center (only if useApi is false)
  if (!useApi) {
    console.warn(`Geocoding: Using default coordinates for "${location}" (no API, no approximation)`);
    const defaultLocation: GeocodeResult = { lng: -96.9, lat: 37.6 };
    setCachedGeocode(location, defaultLocation);
    return defaultLocation;
  }
  
  // If useApi is true but we got here, return null instead of throwing
  console.warn(`Geocoding: Failed for "${location}" (API unavailable and no fallback)`);
  return null;
}

/**
 * Geocode using Mapbox Geocoding API v6
 * Note: This costs $0.75 per 1,000 requests after free tier (100k/month)
 * 
 * Uses v6 API with structured input support for better accuracy
 * See: https://docs.mapbox.com/api/search/geocoding-v6/
 * 
 * Returns null if no results found (instead of throwing)
 */
async function geocodeWithAPI(
  location: string,
  token: string
): Promise<GeocodeResult | null> {
  // Try to parse location into structured components for better accuracy
  const structured = parseLocationString(location);
  
  // Try multiple query strategies for better accuracy
  const queryStrategies: Array<{ url: string; description: string }> = [];
  
  // Strategy 1: Structured query with city and state (most accurate)
  if (structured.city && structured.state) {
    const params = new URLSearchParams({
      access_token: token,
      country: 'us',
      place: structured.city,
      region: structured.state,
      types: 'place,locality,address',
      limit: '3', // Get more results to find best match
      autocomplete: 'false',
    });
    queryStrategies.push({
      url: `https://api.mapbox.com/search/geocode/v6/forward?${params.toString()}`,
      description: `structured (city: "${structured.city}", state: "${structured.state}")`
    });
    
    // Strategy 1b: Also try with ZIP code if available
    if (structured.zipcode) {
      const paramsWithZip = new URLSearchParams({
        access_token: token,
        country: 'us',
        place: structured.city,
        region: structured.state,
        postcode: structured.zipcode,
        types: 'address,place,locality',
        limit: '3',
        autocomplete: 'false',
      });
      queryStrategies.push({
        url: `https://api.mapbox.com/search/geocode/v6/forward?${paramsWithZip.toString()}`,
        description: `structured with ZIP (city: "${structured.city}", state: "${structured.state}", zip: "${structured.zipcode}")`
      });
    }
  }
  
  // Strategy 2: Text search with cleaned location (remove ZIP if present)
  const cleanedLocation = location.replace(/\s+\d{5}(-\d{4})?$/, '').trim();
  if (cleanedLocation !== location) {
    const params = new URLSearchParams({
      access_token: token,
      q: cleanedLocation,
      country: 'us',
      types: 'place,locality,address',
      limit: '3',
    });
    queryStrategies.push({
      url: `https://api.mapbox.com/search/geocode/v6/forward?${params.toString()}`,
      description: `text search (cleaned: "${cleanedLocation}")`
    });
  }
  
  // Strategy 3: Original text search (fallback)
  const params = new URLSearchParams({
    access_token: token,
    q: location,
    country: 'us',
    types: 'place,locality,address',
    limit: '3',
  });
  queryStrategies.push({
    url: `https://api.mapbox.com/search/geocode/v6/forward?${params.toString()}`,
    description: `text search (original: "${location}")`
  });
  
  // Try each strategy until we get a good result
  for (const strategy of queryStrategies) {
    try {
      console.log(`Geocoding API: Trying ${strategy.description} for "${location}"`);
      const response = await fetch(strategy.url);
  
      if (!response.ok) {
        // Handle specific error codes per Mapbox v6 documentation
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error(`Geocoding API error for "${location}" (${strategy.description}):`, {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
          url: strategy.url.replace(token, 'TOKEN_HIDDEN')
        });
        
        // For non-critical errors, try next strategy
        if (response.status === 401) {
          throw new Error('Not Authorized - Invalid Token');
        } else if (response.status === 403) {
          throw new Error('Forbidden - Check your account or token URL restrictions');
        } else if (response.status === 404) {
          throw new Error('Not Found - Check the endpoint');
        } else if (response.status === 422) {
          // Invalid input - try next strategy
          console.warn(`Geocoding API: Invalid input for strategy "${strategy.description}", trying next...`);
          continue;
        } else if (response.status === 429) {
          throw new Error('Rate limit exceeded');
        }
        // For other errors, try next strategy
        console.warn(`Geocoding API: Error ${response.status} for strategy "${strategy.description}", trying next...`);
        continue;
      }
  
      const data = await response.json();
  
      console.log(`Geocoding API: Response for "${location}" (${strategy.description}):`, {
        featuresCount: data.features?.length || 0,
        hasCoordinates: !!data.features?.[0]?.properties?.coordinates,
        hasGeometry: !!data.features?.[0]?.geometry?.coordinates
      });
  
      if (data.features && data.features.length > 0) {
        // Try to find the best match from multiple results
        let bestFeature = data.features[0];
        
        // If we have structured input, prefer features that match the city/state
        if (structured.city && structured.state) {
          const cityLower = structured.city.toLowerCase();
          const stateUpper = structured.state.toUpperCase();
          
          // Look for a feature that matches both city and state
          const matchingFeature = data.features.find((f: any) => {
            const featureCity = f.properties?.name?.toLowerCase() || f.properties?.place_name?.toLowerCase() || '';
            const featureState = f.properties?.region_code?.toUpperCase() || f.properties?.region?.toUpperCase() || '';
            return featureCity.includes(cityLower) && featureState === stateUpper;
          });
          
          if (matchingFeature) {
            bestFeature = matchingFeature;
            console.log(`Geocoding API: Found matching feature for "${structured.city}, ${structured.state}"`);
          }
        }
        
        const coords = bestFeature.properties?.coordinates;
        
        if (coords && coords.longitude && coords.latitude) {
          const result = {
            lng: coords.longitude,
            lat: coords.latitude,
            placeName: bestFeature.properties?.full_address || bestFeature.properties?.name || location,
          };
          console.log(`Geocoding API: Successfully geocoded "${location}" -> [${result.lng}, ${result.lat}] using ${strategy.description}`);
          return result;
        }
        
        // Fallback to geometry coordinates if properties.coordinates not available
        if (bestFeature.geometry?.coordinates && bestFeature.geometry.coordinates.length >= 2) {
          const result = {
            lng: bestFeature.geometry.coordinates[0],
            lat: bestFeature.geometry.coordinates[1],
            placeName: bestFeature.properties?.full_address || bestFeature.properties?.name || location,
          };
          console.log(`Geocoding API: Successfully geocoded "${location}" (from geometry) -> [${result.lng}, ${result.lat}] using ${strategy.description}`);
          return result;
        }
      }
      
      // No results from this strategy, try next one
      console.warn(`Geocoding API: No results from ${strategy.description}, trying next strategy...`);
    } catch (error: any) {
      // If it's a critical error, throw it
      if (error.message?.includes('Not Authorized') || 
          error.message?.includes('Forbidden') || 
          error.message?.includes('Rate limit')) {
        throw error;
      }
      // Otherwise, log and try next strategy
      console.warn(`Geocoding API: Error with ${strategy.description}:`, error.message);
      continue;
    }
  }
  
  console.warn(`Geocoding API: All strategies failed for "${location}"`);
  // Return null instead of throwing - let the caller handle the failure gracefully
  return null as any; // Type assertion needed because function signature expects GeocodeResult
}

/**
 * Parse location string into structured components
 * Uses the robust parseAddress utility for better accuracy
 */
function parseLocationString(location: string): { city?: string; state?: string; zipcode?: string } {
  const trimmed = location.trim();
  
  // Import parseAddress dynamically to avoid circular dependencies
  // Use a more robust parsing approach
  try {
    // Try to extract city, state, and zipcode using regex patterns
    // Pattern 1: "City, State ZIP" (e.g., "OPA LOCKA, FL 33054")
    const cityStateZipMatch = trimmed.match(/^(.+?),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/i);
    if (cityStateZipMatch) {
      return {
        city: cityStateZipMatch[1].trim(),
        state: cityStateZipMatch[2].trim().toUpperCase(),
        zipcode: cityStateZipMatch[3].trim(),
      };
    }
    
    // Pattern 2: "City, State" (e.g., "Los Angeles, CA" or "Atlanta, Georgia")
    const cityStateMatch = trimmed.match(/^(.+?),\s*([A-Z]{2}|[A-Za-z\s]+)$/);
    if (cityStateMatch) {
      return {
        city: cityStateMatch[1].trim(),
        state: cityStateMatch[2].trim().toUpperCase(),
      };
    }
    
    // Pattern 3: "City State ZIP" (e.g., "OPA LOCKA FL 33054")
    const cityStateZipNoCommaMatch = trimmed.match(/^(.+?)\s+([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/i);
    if (cityStateZipNoCommaMatch) {
      return {
        city: cityStateZipNoCommaMatch[1].trim(),
        state: cityStateZipNoCommaMatch[2].trim().toUpperCase(),
        zipcode: cityStateZipNoCommaMatch[3].trim(),
      };
    }
    
    // Pattern 4: Extract state code from anywhere in the string
    const stateCodeMatch = trimmed.match(/\b([A-Z]{2})\b/);
    if (stateCodeMatch) {
      const stateCode = stateCodeMatch[1];
      const validStates = new Set([
        'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
        'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
        'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
        'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
        'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'
      ]);
      
      if (validStates.has(stateCode)) {
        // Extract city (everything before the state code)
        const beforeState = trimmed.substring(0, trimmed.indexOf(stateCode)).trim();
        // Remove common suffixes and clean up
        const city = beforeState.replace(/[,\s]+$/, '').trim();
        
        return {
          city: city || undefined,
          state: stateCode,
        };
      }
    }
  } catch (error) {
    console.warn('Error parsing location string:', error);
  }
  
  return {};
}

/**
 * Get approximate location from common patterns
 * This avoids API calls for well-known locations
 */
function getApproximateLocation(location: string): GeocodeResult | null {
  const normalized = location.toLowerCase().trim();
  const upperNormalized = location.toUpperCase().trim();
  
  // State code to state name mapping
  const stateCodeMap: Record<string, string> = {
    'AL': 'alabama', 'AK': 'alaska', 'AZ': 'arizona', 'AR': 'arkansas', 'CA': 'california',
    'CO': 'colorado', 'CT': 'connecticut', 'DE': 'delaware', 'FL': 'florida', 'GA': 'georgia',
    'HI': 'hawaii', 'ID': 'idaho', 'IL': 'illinois', 'IN': 'indiana', 'IA': 'iowa',
    'KS': 'kansas', 'KY': 'kentucky', 'LA': 'louisiana', 'ME': 'maine', 'MD': 'maryland',
    'MA': 'massachusetts', 'MI': 'michigan', 'MN': 'minnesota', 'MS': 'mississippi', 'MO': 'missouri',
    'MT': 'montana', 'NE': 'nebraska', 'NV': 'nevada', 'NH': 'new hampshire', 'NJ': 'new jersey',
    'NM': 'new mexico', 'NY': 'new york', 'NC': 'north carolina', 'ND': 'north dakota', 'OH': 'ohio',
    'OK': 'oklahoma', 'OR': 'oregon', 'PA': 'pennsylvania', 'RI': 'rhode island', 'SC': 'south carolina',
    'SD': 'south dakota', 'TN': 'tennessee', 'TX': 'texas', 'UT': 'utah', 'VT': 'vermont',
    'VA': 'virginia', 'WA': 'washington', 'WV': 'west virginia', 'WI': 'wisconsin', 'WY': 'wyoming',
    'DC': 'district of columbia'
  };
  
  // Common US state centers (approximate)
  const stateCenters: Record<string, [number, number]> = {
    'alabama': [-86.7911, 32.806671],
    'alaska': [-152.404419, 61.370716],
    'arizona': [-111.431221, 33.729759],
    'arkansas': [-92.373123, 34.969704],
    'california': [-119.681564, 36.116203],
    'colorado': [-105.311104, 39.059811],
    'connecticut': [-72.755371, 41.597782],
    'delaware': [-75.52767, 39.318523],
    'florida': [-81.686783, 27.766279],
    'georgia': [-83.643074, 33.040619],
    'hawaii': [-157.498337, 21.094318],
    'idaho': [-114.478828, 44.240459],
    'illinois': [-88.986137, 40.349457],
    'indiana': [-86.258278, 39.849426],
    'iowa': [-93.620866, 42.011539],
    'kansas': [-98.484246, 38.5266],
    'kentucky': [-84.670067, 37.66814],
    'louisiana': [-91.867805, 31.169546],
    'maine': [-69.765261, 44.323535],
    'maryland': [-76.802101, 39.063946],
    'massachusetts': [-71.530106, 42.230171],
    'michigan': [-84.5467, 43.326618],
    'minnesota': [-93.900192, 45.694454],
    'mississippi': [-89.667526, 32.741646],
    'missouri': [-92.189283, 38.456085],
    'montana': [-110.454353, 46.921925],
    'nebraska': [-98.268082, 41.12537],
    'nevada': [-117.055374, 38.313515],
    'new hampshire': [-71.5653, 43.452492],
    'new jersey': [-74.521011, 40.298904],
    'new mexico': [-106.248482, 34.840515],
    'new york': [-74.948051, 42.165726],
    'north carolina': [-79.0193, 35.630066],
    'north dakota': [-99.784012, 47.528912],
    'ohio': [-82.764915, 40.388783],
    'oklahoma': [-97.534994, 35.565342],
    'oregon': [-122.070938, 44.572021],
    'pennsylvania': [-77.209755, 40.590752],
    'rhode island': [-71.51178, 41.680893],
    'south carolina': [-80.945007, 33.856892],
    'south dakota': [-99.901813, 44.299782],
    'tennessee': [-86.784, 35.747845],
    'texas': [-99.901813, 31.054487],
    'utah': [-111.892622, 40.150032],
    'vermont': [-72.731686, 44.045876],
    'virginia': [-78.169968, 37.769337],
    'washington': [-121.490494, 47.400902],
    'west virginia': [-80.969604, 38.491226],
    'wisconsin': [-89.616508, 44.268543],
    'wyoming': [-107.30249, 42.755966],
    'district of columbia': [-77.0369, 38.9072],
  };

  // First, try to extract state code (e.g., "FL" from "OPA LOCKA, FL 33054")
  // Pattern: ", ST " or ", ST" or " ST " or " ST"
  const stateCodeMatch = upperNormalized.match(/[,\s]+([A-Z]{2})(?:\s|$)/);
  if (stateCodeMatch && stateCodeMatch[1] && stateCodeMap[stateCodeMatch[1]]) {
    const stateName = stateCodeMap[stateCodeMatch[1]];
    if (stateCenters[stateName]) {
      const [lng, lat] = stateCenters[stateName];
      console.log(`Geocoding: Using state center for "${location}" (extracted state code: ${stateCodeMatch[1]})`);
      return { lng, lat, placeName: stateName };
    }
  }

  // Check for state names
  for (const [state, [lng, lat]] of Object.entries(stateCenters)) {
    if (normalized.includes(state)) {
      return { lng, lat, placeName: state };
    }
  }

  // Check for common city patterns (very basic)
  // In production, you'd want a more comprehensive city database
  const commonCities: Record<string, [number, number]> = {
    'atlanta': [-84.3880, 33.7490],
    'chicago': [-87.6298, 41.8781],
    'dallas': [-96.7970, 32.7767],
    'denver': [-104.9903, 39.7392],
    'houston': [-95.3698, 29.7604],
    'los angeles': [-118.2437, 34.0522],
    'miami': [-80.1918, 25.7617],
    'new york': [-74.0060, 40.7128],
    'philadelphia': [-75.1652, 39.9526],
    'phoenix': [-112.0740, 33.4484],
    'san antonio': [-98.4936, 29.4241],
    'san diego': [-117.1611, 32.7157],
    'san francisco': [-122.4194, 37.7749],
    'seattle': [-122.3321, 47.6062],
  };

  for (const [city, [lng, lat]] of Object.entries(commonCities)) {
    if (normalized.includes(city)) {
      return { lng, lat, placeName: city };
    }
  }

  return null;
}

/**
 * Get cached geocode result
 */
function getCachedGeocode(location: string): GeocodeResult | null {
  try {
    const cacheStr = sessionStorage.getItem(GEOCODE_CACHE_KEY);
    if (!cacheStr) return null;

    const cache: Record<string, CachedGeocode> = JSON.parse(cacheStr);
    const cached = cache[location.toLowerCase()];
    
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.result;
    }
    
    // Remove expired entry
    delete cache[location.toLowerCase()];
    sessionStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(cache));
    
    return null;
  } catch (error) {
    console.warn('Failed to read geocode cache:', error);
    return null;
  }
}

/**
 * Cache geocode result
 */
function setCachedGeocode(location: string, result: GeocodeResult): void {
  try {
    const cacheStr = sessionStorage.getItem(GEOCODE_CACHE_KEY);
    const cache: Record<string, CachedGeocode> = cacheStr 
      ? JSON.parse(cacheStr) 
      : {};
    
    cache[location.toLowerCase()] = {
      result,
      timestamp: Date.now(),
    };
    
    // Limit cache size to prevent storage issues
    const entries = Object.entries(cache);
    if (entries.length > 1000) {
      // Remove oldest 500 entries
      const sorted = entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      const toKeep = sorted.slice(-500);
      const newCache: Record<string, CachedGeocode> = {};
      toKeep.forEach(([key, value]) => {
        newCache[key] = value;
      });
      sessionStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(newCache));
    } else {
      sessionStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(cache));
    }
  } catch (error) {
    console.warn('Failed to cache geocode result:', error);
  }
}

/**
 * Batch geocode multiple locations using v6 Batch API
 * More efficient than individual calls - up to 1000 queries per request
 * See: https://docs.mapbox.com/api/search/geocoding-v6/#batch-geocoding
 */
export async function geocodeBatch(
  locations: string[],
  useApi: boolean = false
): Promise<GeocodeResult[]> {
  if (!useApi || locations.length === 0) {
    // Fallback to parallel individual calls
    return Promise.all(
      locations.map(loc => geocodeLocation(loc, useApi))
    );
  }

  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || 
                process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  
  if (!token) {
    console.warn('Mapbox token not found for batch geocoding');
    return Promise.all(
      locations.map(loc => geocodeLocation(loc, false))
    );
  }

  // Check cache first for all locations
  const cachedResults: (GeocodeResult | null)[] = locations.map(loc => getCachedGeocode(loc));
  const uncachedIndices: number[] = [];
  const uncachedLocations: string[] = [];

  cachedResults.forEach((cached, index) => {
    if (!cached) {
      uncachedIndices.push(index);
      uncachedLocations.push(locations[index]);
    }
  });

  // If all are cached, return cached results
  if (uncachedLocations.length === 0) {
    return cachedResults as GeocodeResult[];
  }

  // Use v6 Batch API for uncached locations (max 1000 per request)
  try {
    const batchQueries = uncachedLocations.map(loc => {
      const structured = parseLocationString(loc);
      if (structured.city && structured.state) {
        return {
          country: 'us',
          place: structured.city,
          region: structured.state,
          types: ['place', 'locality', 'address'],
          limit: 1,
          autocomplete: false,
        };
      }
      return {
        q: loc,
        country: 'us',
        types: ['place', 'locality', 'address'],
        limit: 1,
      };
    });

    const response = await fetch(
      `https://api.mapbox.com/search/geocode/v6/batch?access_token=${token}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(batchQueries),
      }
    );

    if (!response.ok) {
      throw new Error(`Batch geocoding error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.batch && Array.isArray(data.batch)) {
      // Process batch results
      const results: GeocodeResult[] = [...cachedResults] as GeocodeResult[];
      
      data.batch.forEach((batchItem: any, batchIndex: number) => {
        const originalIndex = uncachedIndices[batchIndex];
        const originalLocation = uncachedLocations[batchIndex];
        
        if (batchItem.features && batchItem.features.length > 0) {
          const feature = batchItem.features[0];
          const coords = feature.properties?.coordinates;
          
          let result: GeocodeResult | null = null;
          
          if (coords && coords.longitude && coords.latitude) {
            result = {
              lng: coords.longitude,
              lat: coords.latitude,
              placeName: feature.properties?.full_address || feature.properties?.name || originalLocation,
            };
          } else if (feature.geometry?.coordinates && feature.geometry.coordinates.length >= 2) {
            result = {
              lng: feature.geometry.coordinates[0],
              lat: feature.geometry.coordinates[1],
              placeName: feature.properties?.full_address || feature.properties?.name || originalLocation,
            };
          }
          
          if (result) {
            setCachedGeocode(originalLocation, result);
            results[originalIndex] = result;
          } else {
            // Fallback to approximation
            const approx = getApproximateLocation(originalLocation);
            if (approx) {
              setCachedGeocode(originalLocation, approx);
              results[originalIndex] = approx;
            } else {
              results[originalIndex] = { lng: -96.9, lat: 37.6 };
            }
          }
        } else {
          // No results - use approximation or default
          const approx = getApproximateLocation(originalLocation);
          if (approx) {
            setCachedGeocode(originalLocation, approx);
            results[originalIndex] = approx;
          } else {
            results[originalIndex] = { lng: -96.9, lat: 37.6 };
          }
        }
      });
      
      return results;
    }
  } catch (error) {
    console.warn('Batch geocoding failed, falling back to individual calls:', error);
  }

  // Fallback to parallel individual calls
  return Promise.all(
    locations.map((loc, index) => {
      if (cachedResults[index]) {
        return Promise.resolve(cachedResults[index]!);
      }
      return geocodeLocation(loc, useApi);
    })
  );
}

