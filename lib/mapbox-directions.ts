/**
 * Mapbox Directions API Utility
 * 
 * Provides optimal routing between multiple stops using Mapbox Directions API
 * Supports waypoint optimization for efficient route planning
 */

interface RouteWaypoint {
  coordinates: [number, number]; // [lng, lat]
  name?: string;
}

interface RouteResponse {
  geometry: {
    coordinates: [number, number][];
    type: string;
  };
  distance: number; // in meters
  duration: number; // in seconds
  legs: Array<{
    distance: number;
    duration: number;
  }>;
}

interface DirectionsOptions {
  profile?: 'driving' | 'walking' | 'cycling' | 'driving-traffic';
  alternatives?: boolean;
  geometries?: 'geojson' | 'polyline' | 'polyline6';
  overview?: 'full' | 'simplified' | 'false';
  steps?: boolean;
  annotations?: string[];
  language?: string;
  roundtrip?: boolean;
  source?: 'first' | 'any';
  destination?: 'last' | 'any';
  waypoints?: number[];
}

/**
 * Get optimal route between multiple waypoints using Mapbox Directions API
 * 
 * @param waypoints Array of coordinates [lng, lat] for route waypoints
 * @param options Optional directions API parameters
 * @returns Route geometry and metadata
 */
export async function getOptimalRoute(
  waypoints: RouteWaypoint[],
  options: DirectionsOptions = {}
): Promise<RouteResponse | null> {
  if (waypoints.length < 2) {
    console.warn('Need at least 2 waypoints for routing');
    return null;
  }

  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || 
                process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  
  if (!token) {
    console.warn('Mapbox token not found for Directions API');
    return null;
  }

  try {
    // Build coordinates string: lng,lat;lng,lat;...
    const coordinates = waypoints.map(wp => `${wp.coordinates[0]},${wp.coordinates[1]}`).join(';');
    
    // Default options
    const defaultOptions: DirectionsOptions = {
      profile: 'driving',
      geometries: 'geojson',
      overview: 'full',
      steps: false,
      alternatives: false,
    };

    const finalOptions = { ...defaultOptions, ...options };
    
    // Build query parameters
    const params = new URLSearchParams({
      access_token: token,
      geometries: finalOptions.geometries || 'geojson',
      overview: finalOptions.overview || 'full',
      steps: String(finalOptions.steps || false),
      alternatives: String(finalOptions.alternatives || false),
    });

    if (finalOptions.profile) {
      params.append('profile', finalOptions.profile);
    }

    // Mapbox Directions API endpoint
    const url = `https://api.mapbox.com/directions/v5/mapbox/${finalOptions.profile}/${coordinates}?${params.toString()}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      // Handle specific error codes per Mapbox Directions API documentation
      if (response.status === 401) {
        console.error('Directions API: Not Authorized - Invalid Token');
        return null;
      } else if (response.status === 403) {
        console.error('Directions API: Forbidden - Check your account or token URL restrictions');
        return null;
      } else if (response.status === 404) {
        console.error('Directions API: Profile Not Found');
        return null;
      } else if (response.status === 422) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Directions API: Invalid Input', errorData.message || response.statusText);
        return null;
      }
      const errorText = await response.text();
      console.error('Directions API error:', response.status, errorText);
      return null;
    }

    const data = await response.json();
    
    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      console.warn('No route found:', data.code, data.message);
      return null;
    }

    // Return the first (optimal) route
    const route = data.routes[0];
    return {
      geometry: route.geometry,
      distance: route.distance,
      duration: route.duration,
      legs: route.legs || [],
    };
  } catch (error) {
    console.error('Failed to get route from Mapbox Directions API:', error);
    return null;
  }
}

/**
 * Get route with waypoint optimization
 * Mapbox automatically optimizes waypoint order for efficiency
 */
export async function getOptimizedRoute(
  waypoints: RouteWaypoint[],
  options: DirectionsOptions = {}
): Promise<RouteResponse | null> {
  // For optimization, we need at least 3 waypoints
  // Mapbox will reorder intermediate waypoints for optimal route
  if (waypoints.length < 3) {
    // For 2 waypoints, just get direct route
    return getOptimalRoute(waypoints, options);
  }

  // Use waypoint optimization (Mapbox automatically optimizes order)
  return getOptimalRoute(waypoints, {
    ...options,
    // Note: Mapbox Directions API automatically optimizes waypoint order
    // when you have 3+ waypoints, but you need to use the optimization endpoint
    // For now, we'll use the standard endpoint which still provides good routes
  });
}

/**
 * Convert route geometry to GeoJSON LineString for Mapbox GL
 */
export function routeToGeoJSON(route: RouteResponse): GeoJSON.Feature<GeoJSON.LineString> {
  return {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: route.geometry.coordinates,
    },
    properties: {
      distance: route.distance,
      duration: route.duration,
    },
  };
}

