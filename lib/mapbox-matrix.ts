/**
 * Mapbox Matrix API Utility
 * 
 * Calculates travel times and distances between multiple points efficiently.
 * Useful for determining reachability, filtering by travel time, or optimization algorithms.
 * 
 * See: https://docs.mapbox.com/api/navigation/matrix/
 */

interface MatrixWaypoint {
  coordinates: [number, number]; // [longitude, latitude]
  name?: string;
}

interface MatrixOptions {
  profile?: 'driving' | 'walking' | 'cycling' | 'driving-traffic';
  annotations?: 'duration' | 'distance' | 'duration,distance';
  sources?: 'all' | number[] | string; // Indices or 'all'
  destinations?: 'all' | number[] | string; // Indices or 'all'
}

interface MatrixResponse {
  code: string;
  durations?: number[][]; // durations[i][j] = time from source i to destination j (seconds)
  distances?: number[][]; // distances[i][j] = distance from source i to destination j (meters)
  sources: Array<{
    name: string;
    location: [number, number];
    distance?: number;
  }>;
  destinations: Array<{
    name: string;
    location: [number, number];
    distance?: number;
  }>;
}

/**
 * Get travel time and distance matrix between multiple points
 * 
 * @param waypoints Array of coordinate pairs
 * @param options Matrix API options
 * @returns Matrix response with durations and/or distances
 * 
 * @example
 * const matrix = await getTravelMatrix([
 *   [-122.4194, 37.7749], // San Francisco
 *   [-118.2437, 34.0522], // Los Angeles
 *   [-87.6298, 41.8781]   // Chicago
 * ]);
 * // matrix.durations[0][1] = travel time from SF to LA
 */
export async function getTravelMatrix(
  waypoints: MatrixWaypoint[] | Array<[number, number]>,
  options: MatrixOptions = {}
): Promise<MatrixResponse | null> {
  if (waypoints.length < 2) {
    console.warn('Matrix API requires at least 2 waypoints');
    return null;
  }

  // Maximum 25 coordinates for most profiles, 10 for driving-traffic
  const maxWaypoints = options.profile === 'driving-traffic' ? 10 : 25;
  if (waypoints.length > maxWaypoints) {
    console.warn(`Matrix API supports max ${maxWaypoints} waypoints for ${options.profile || 'driving'}`);
    return null;
  }

  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || 
                process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  
  if (!token) {
    console.warn('Mapbox token not found for Matrix API');
    return null;
  }

  try {
    // Convert waypoints to coordinate string format: lng,lat;lng,lat;...
    const coordinates = waypoints.map(wp => {
      if (Array.isArray(wp)) {
        return `${wp[0]},${wp[1]}`;
      }
      return `${wp.coordinates[0]},${wp.coordinates[1]}`;
    }).join(';');

    const profile = options.profile || 'driving';
    const annotations = options.annotations || 'duration';
    
    // Build query parameters
    const params = new URLSearchParams({
      access_token: token,
      annotations: annotations,
    });

    // Add optional sources/destinations if specified
    if (options.sources && options.sources !== 'all') {
      if (Array.isArray(options.sources)) {
        params.append('sources', options.sources.join(';'));
      } else {
        params.append('sources', options.sources);
      }
    }

    if (options.destinations && options.destinations !== 'all') {
      if (Array.isArray(options.destinations)) {
        params.append('destinations', options.destinations.join(';'));
      } else {
        params.append('destinations', options.destinations);
      }
    }

    const url = `https://api.mapbox.com/directions-matrix/v1/mapbox/${profile}/${coordinates}?${params.toString()}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      // Handle specific error codes per Mapbox Matrix API documentation
      if (response.status === 401) {
        console.error('Matrix API: Not Authorized - Invalid Token');
        return null;
      } else if (response.status === 403) {
        console.error('Matrix API: Forbidden - Check your account or token URL restrictions');
        return null;
      } else if (response.status === 404) {
        console.error('Matrix API: Profile Not Found');
        return null;
      } else if (response.status === 422) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Matrix API: Invalid Input', errorData.message || response.statusText);
        return null;
      }
      console.error(`Matrix API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    
    if (data.code !== 'Ok') {
      console.warn('Matrix API returned non-OK code:', data.code);
      return null;
    }
    
    return data as MatrixResponse;
  } catch (error) {
    console.error('Error fetching travel matrix:', error);
    return null;
  }
}

/**
 * Get travel time between two points (simplified Matrix API call)
 * 
 * @param from Starting coordinates [lng, lat]
 * @param to Destination coordinates [lng, lat]
 * @param profile Routing profile
 * @returns Travel time in seconds, or null if unavailable
 */
export async function getTravelTime(
  from: [number, number],
  to: [number, number],
  profile: 'driving' | 'walking' | 'cycling' | 'driving-traffic' = 'driving'
): Promise<number | null> {
  const matrix = await getTravelMatrix([from, to], {
    profile,
    annotations: 'duration',
  });

  if (matrix && matrix.durations && matrix.durations.length > 0 && matrix.durations[0].length > 1) {
    return matrix.durations[0][1]; // Duration from first to second point
  }

  return null;
}

/**
 * Get travel distance between two points (simplified Matrix API call)
 * 
 * @param from Starting coordinates [lng, lat]
 * @param to Destination coordinates [lng, lat]
 * @param profile Routing profile
 * @returns Travel distance in meters, or null if unavailable
 */
export async function getTravelDistance(
  from: [number, number],
  to: [number, number],
  profile: 'driving' | 'walking' | 'cycling' | 'driving-traffic' = 'driving'
): Promise<number | null> {
  const matrix = await getTravelMatrix([from, to], {
    profile,
    annotations: 'distance',
  });

  if (matrix && matrix.distances && matrix.distances.length > 0 && matrix.distances[0].length > 1) {
    return matrix.distances[0][1]; // Distance from first to second point
  }

  return null;
}

