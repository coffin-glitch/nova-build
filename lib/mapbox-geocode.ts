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
): Promise<GeocodeResult> {
  // Check cache first
  const cached = getCachedGeocode(location);
  if (cached) {
    return cached;
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
  
  if (token && useApi) {
    try {
      const result = await geocodeWithAPI(location, token);
      setCachedGeocode(location, result);
      return result;
    } catch (error) {
      console.warn(`Geocoding API failed for "${location}":`, error);
      // Fall back to approximation
      const fallback = getApproximateLocation(location);
      if (fallback) {
        setCachedGeocode(location, fallback);
        return fallback;
      }
    }
  }

  // Final fallback: default US center
  const defaultLocation: GeocodeResult = { lng: -96.9, lat: 37.6 };
  setCachedGeocode(location, defaultLocation);
  return defaultLocation;
}

/**
 * Geocode using Mapbox Geocoding API v6
 * Note: This costs $0.75 per 1,000 requests after free tier (100k/month)
 * 
 * Uses v6 API with structured input support for better accuracy
 * See: https://docs.mapbox.com/api/search/geocoding-v6/
 */
async function geocodeWithAPI(
  location: string,
  token: string
): Promise<GeocodeResult> {
  // Try to parse location into structured components for better accuracy
  // Format: "City, State" or just city/state string
  const structured = parseLocationString(location);
  
  let url: string;
  
  if (structured.city && structured.state) {
    // Use structured input for better accuracy (v6 feature)
    const params = new URLSearchParams({
      access_token: token,
      country: 'us',
      place: structured.city,
      region: structured.state,
      types: 'place,locality,address',
      limit: '1',
      autocomplete: 'false', // Disable autocomplete for exact matches
    });
    url = `https://api.mapbox.com/search/geocode/v6/forward?${params.toString()}`;
  } else {
    // Fallback to text search
    const encodedLocation = encodeURIComponent(location);
    const params = new URLSearchParams({
      access_token: token,
      q: location,
      country: 'us',
      types: 'place,locality,address',
      limit: '1',
    });
    url = `https://api.mapbox.com/search/geocode/v6/forward?${params.toString()}`;
  }
  
  const response = await fetch(url);
  
  if (!response.ok) {
    // Handle specific error codes per Mapbox v6 documentation
    if (response.status === 401) {
      throw new Error('Not Authorized - Invalid Token');
    } else if (response.status === 403) {
      throw new Error('Forbidden - Check your account or token URL restrictions');
    } else if (response.status === 404) {
      throw new Error('Not Found - Check the endpoint');
    } else if (response.status === 422) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Invalid Input: ${errorData.message || response.statusText}`);
    } else if (response.status === 429) {
      throw new Error('Rate limit exceeded');
    }
    throw new Error(`Geocoding API error: ${response.status} ${response.statusText}`);
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
    
    // Fallback to geometry coordinates if properties.coordinates not available
    if (feature.geometry?.coordinates && feature.geometry.coordinates.length >= 2) {
      return {
        lng: feature.geometry.coordinates[0],
        lat: feature.geometry.coordinates[1],
        placeName: feature.properties?.full_address || feature.properties?.name || location,
      };
    }
  }
  
  throw new Error('No results found');
}

/**
 * Parse location string into structured components
 * Attempts to extract city and state from "City, State" format
 */
function parseLocationString(location: string): { city?: string; state?: string } {
  const trimmed = location.trim();
  
  // Try "City, State" pattern (e.g., "Los Angeles, CA" or "Atlanta, Georgia")
  const cityStateMatch = trimmed.match(/^(.+?),\s*([A-Z]{2}|[A-Za-z\s]+)$/);
  if (cityStateMatch) {
    return {
      city: cityStateMatch[1].trim(),
      state: cityStateMatch[2].trim(),
    };
  }
  
  return {};
}

/**
 * Get approximate location from common patterns
 * This avoids API calls for well-known locations
 */
function getApproximateLocation(location: string): GeocodeResult | null {
  const normalized = location.toLowerCase().trim();
  
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
  };

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

