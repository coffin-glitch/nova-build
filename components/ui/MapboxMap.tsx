"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { MapPin, Navigation, Truck, ZoomIn, Loader2, Info, Bug, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useTheme } from "next-themes";
import MapProvider from "@/lib/mapbox/provider";
import { useMap } from "@/context/map-context";
import mapboxgl from "mapbox-gl";

interface MapboxMapProps {
  stops: string[];
  className?: string;
  /**
   * If true, uses static map image initially (cheaper)
   * User can click to load full interactive map
   */
  lazy?: boolean;
  /**
   * Minimum height for the map container
   */
  minHeight?: string;
  /**
   * If true, allows admin to see and toggle debug box
   */
  isAdmin?: boolean;
}

export function MapboxMap({ 
  stops, 
  className = "",
  lazy = true,
  minHeight = "300px",
  isAdmin = false
}: MapboxMapProps) {
  const [hasMapboxToken, setHasMapboxToken] = useState(false);
  const [isInteractive, setIsInteractive] = useState(!lazy);
  const [isLoading, setIsLoading] = useState(false);
  const [mapInstance, setMapInstance] = useState<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const { theme } = useTheme();
  const [isVisible, setIsVisible] = useState(!lazy);
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attributionOpen, setAttributionOpen] = useState(false);
  const [showDebugBox, setShowDebugBox] = useState(false);

  // Check if component is mounted (client-side only)
  useEffect(() => {
    setMounted(true);
  }, []);

    // Check if Mapbox token is available
  useEffect(() => {
    if (!mounted) return;
    const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || 
                  process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    setHasMapboxToken(!!token);
  }, [mounted]);

  // Intersection Observer for lazy loading - only load when visible
  useEffect(() => {
    if (!lazy || !mounted || !mapContainerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        });
      },
      { threshold: 0.1 } // Trigger when 10% visible
    );

    observer.observe(mapContainerRef.current);

    return () => observer.disconnect();
  }, [lazy, mounted]);

  // Geocode a stop location (with caching to reduce API calls)
  // Best Practice: For route maps, use API geocoding for accuracy (approximations aren't good enough)
  const geocodeStop = useCallback(async (stop: string): Promise<[number, number]> => {
    try {
      // Use the geocoding utility with API enabled for accurate coordinates
      // Route maps require precise locations, so we use API geocoding (not approximations)
      const { geocodeLocation } = await import('@/lib/mapbox-geocode');
      const { formatAddressForCard, extractCityStateForMatching, parseAddress } = await import('@/lib/format');
      
      // STANDARD FORMAT: Normalize to "City, ST ZIPCODE" format first
      // This is the standard format for bid routes, so prioritize it
      const standardizedFormat = formatAddressForCard(stop);
      console.log(`MapboxMap: Standardizing "${stop}" -> "${standardizedFormat}" for geocoding`);
      
      // Primary geocoding attempt with standardized "City, ST ZIPCODE" format
      let result = await geocodeLocation(standardizedFormat, true); // true = use API for accurate coordinates
      
      // If API fails, try alternative formats before giving up
      if (!result) {
        console.warn(`MapboxMap: Geocoding failed for standardized format "${standardizedFormat}", trying alternative formats...`);
        
        // Strategy 1: Try with just city and state (remove ZIP if present)
        const parsed = parseAddress(stop);
        if (parsed.city && parsed.state) {
          const cityStateFormat = `${parsed.city}, ${parsed.state}`;
          if (cityStateFormat !== standardizedFormat) {
            console.log(`MapboxMap: Trying city/state only: "${cityStateFormat}"`);
            result = await geocodeLocation(cityStateFormat, true);
          }
        }
        
        // Strategy 2: Try using extractCityStateForMatching (more robust)
        if (!result) {
          const cityState = extractCityStateForMatching(stop);
          if (cityState) {
            const cityStateFormat = `${cityState.city}, ${cityState.state}`;
            console.log(`MapboxMap: Trying extracted city/state: "${cityStateFormat}"`);
            result = await geocodeLocation(cityStateFormat, true);
          }
        }
        
        // Strategy 3: Try original format as fallback (in case it's already in correct format)
        if (!result && stop !== standardizedFormat) {
          console.log(`MapboxMap: Trying original format: "${stop}"`);
          result = await geocodeLocation(stop, true);
        }
        
        // If all strategies failed, throw error
        if (!result) {
          console.error(`MapboxMap: All geocoding strategies failed for "${stop}"`);
          throw new Error(`Geocoding failed: No results found for "${stop}"`);
        }
      }
      
      // Validate that we got real coordinates (not default fallback)
      if (result.lng === -96.9 && result.lat === 37.6) {
        console.error(`MapboxMap: Geocoding returned default coordinates for "${stop}" - this should not happen with API enabled`);
        throw new Error(`Geocoding failed: API returned default coordinates for "${stop}"`);
      }
      
      console.log(`MapboxMap: Successfully geocoded "${stop}" -> [${result.lng}, ${result.lat}]`);
      return [result.lng, result.lat];
    } catch (error) {
      console.error(`MapboxMap: Geocoding error for "${stop}":`, error);
      
      // Re-throw the error - we've already tried all fallback strategies above
      throw error;
    }
  }, []);

  // Load interactive map - fixed implementation
  const loadInteractiveMap = useCallback(async () => {
    // Only skip if map already exists, currently loading, or prerequisites not met
    // Note: Don't check mapContainerRef here - let it be checked later to avoid race conditions
    if (mapRef.current || isLoading || !hasMapboxToken || !mounted) {
      console.log('MapboxMap: Skipping loadInteractiveMap', {
        hasMap: !!mapRef.current,
        isLoading,
        hasMapboxToken,
        hasContainer: !!mapContainerRef.current,
        mounted
      });
      return;
    }

    // Check if container is ready - if not, return early (retry mechanism will handle it)
    if (!mapContainerRef.current) {
      console.log('MapboxMap: Container not ready yet, will retry');
      return;
    }

    console.log('MapboxMap: Starting loadInteractiveMap');
    setIsLoading(true);
    
    try {
      // Dynamically import Mapbox GL JS only when needed (code splitting)
      const mapboxgl = (await import('mapbox-gl')).default;
      
      // Import CSS
      await import('mapbox-gl/dist/mapbox-gl.css');

      const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || 
                    process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
      
      if (!token) {
        throw new Error('Mapbox token not found');
      }

      mapboxgl.accessToken = token;

      // Get initial center from first stop (or default)
      let initialCenter: [number, number] = [-96.9, 37.6];
      let initialZoom = 6;

      if (stops.length > 0) {
        try {
          initialCenter = await geocodeStop(stops[0]);
        } catch (error) {
          console.warn('Failed to geocode initial center, using default');
        }
      }

      // Use theme-based v11 styles (stable and well-supported)
      // TODO: Upgrade to Mapbox Standard style when GL JS version fully supports it
      // Standard style URL: 'mapbox://styles/mapbox/standard'
      // Reference: https://docs.mapbox.com/map-styles/standard/guides/
      const mapStyle = theme === "dark" 
        ? "mapbox://styles/mapbox/dark-v11" 
        : "mapbox://styles/mapbox/light-v11";

      // Double-check container is still ready (it might have been unmounted during async operations)
      if (!mapContainerRef.current) {
        console.warn('MapboxMap: Container became unavailable during initialization');
        setIsLoading(false);
        return;
      }

      // Wait for container to have dimensions (important for dialogs/modals)
      const container = mapContainerRef.current;
      if (container.offsetWidth === 0 || container.offsetHeight === 0) {
        // Retry after a short delay if container has no dimensions
        console.log('MapboxMap: Container has no dimensions yet, will retry');
        setIsLoading(false);
        setTimeout(() => {
          if (mapContainerRef.current && 
              mapContainerRef.current.offsetWidth > 0 && 
              mapContainerRef.current.offsetHeight > 0) {
            loadInteractiveMap();
          }
        }, 100);
        return;
      }

      // Configure map with proper options per Mapbox GL JS docs
      const map = new mapboxgl.Map({
        container: container,
        style: mapStyle,
        center: initialCenter,
        zoom: initialZoom,
        // Optimize for cost: reduce zoom levels
        minZoom: 3,
        maxZoom: 15,
        pitch: 0,
        bearing: 0,
        antialias: false,
        preserveDrawingBuffer: false,
        // Interaction options
        clickTolerance: 3, // Max pixels user can shift mouse during click
        boxZoom: true, // Enable box zoom (shift+drag)
        doubleClickZoom: true, // Enable double-click zoom
        dragPan: true, // Enable drag to pan
        dragRotate: true, // Enable drag to rotate (right-click or ctrl+drag)
        keyboard: true, // Enable keyboard shortcuts
        scrollZoom: true, // Enable scroll to zoom
        touchPitch: true, // Enable touch pitch
        touchZoomRotate: true, // Enable pinch to zoom/rotate
        // Performance options
        trackResize: true, // Auto-resize on window resize
        renderWorldCopies: true, // Render multiple world copies
        // Attribution - disabled, using custom "i" icon instead
        attributionControl: false,
        logoPosition: 'bottom-right',
        // Add transform request to handle CORS if needed
        transformRequest: (url: string, resourceType: string) => {
          if (resourceType === 'Style' && url.startsWith('https://api.mapbox.com')) {
            return {
              url: url,
              headers: {}
            };
          }
          return { url };
        }
      });

      // Handle style loading errors with retry and better logging
      let retryCount = 0;
      const maxRetries = 2;
      
      map.on('error', (e: any) => {
        // Extract error message from various possible locations
        const errorMessage = e?.error?.message || e?.error || e?.message || '';
        
        // Only log if there's a meaningful error message (not empty string or empty object)
        if (errorMessage && 
            typeof errorMessage === 'string' && 
            errorMessage.trim() !== '' &&
            errorMessage !== 'Unknown error') {
          console.error('Mapbox error:', {
            message: errorMessage,
            type: e?.type || 'unknown',
            target: e?.target?.toString() || 'unknown',
            fullError: e
          });
          
          // Retry if it's a style loading error and we haven't exceeded max retries
          if (errorMessage.includes('Failed to fetch') && retryCount < maxRetries) {
            retryCount++;
            console.warn(`Retrying map style load (attempt ${retryCount}/${maxRetries})...`);
            setTimeout(() => {
              map.setStyle(mapStyle);
            }, 1000 * retryCount); // Exponential backoff
          }
        }
        // Silently ignore empty errors - they're often non-critical Mapbox internal events
      });

      // Wait for map to load before adding markers and route
      // Following the guide's best practices: wait for 'load' event, then fetch route
      map.on('load', async () => {
        try {
          // CRITICAL: Resize map multiple times to ensure it displays correctly in dialogs
          // Per web search: maps in hidden containers need resize() after becoming visible
          // CRITICAL: Check if map still exists and is valid before calling resize()
          if (map && typeof map.resize === 'function') {
            try {
              map.resize();
            } catch (resizeError) {
              console.warn('MapboxMap: Error resizing map on load (may be destroyed):', resizeError);
            }
          }
          // Additional resize after a short delay to handle dialog animations
          setTimeout(() => {
            if (mapRef.current && typeof mapRef.current.resize === 'function') {
              try {
                mapRef.current.resize();
              } catch (resizeError) {
                console.warn('MapboxMap: Error resizing map after delay (may be destroyed):', resizeError);
              }
            }
          }, 200);

          // Clear existing markers and route
          markersRef.current.forEach(marker => marker.remove());
          markersRef.current = [];

          // Remove existing route if present
          if (map.getSource('route')) {
            if (map.getLayer('route')) {
              map.removeLayer('route');
            }
            map.removeSource('route');
          }

          // Validate stops before processing
          if (!stops || stops.length === 0) {
            console.warn('No stops provided to map');
            return;
          }

          // Filter out empty or invalid stops
          const validStops = stops.filter(s => s && typeof s === 'string' && s.trim().length > 0);
          
          if (validStops.length === 0) {
            console.warn('No valid stops found after filtering');
            return;
          }

          // Step 1: Geocode all stops to get coordinates
          // Best Practice: Process stops sequentially to preserve order and handle errors gracefully
          console.log(`MapboxMap: Processing ${validStops.length} stops:`, validStops);
          
          const coordinateData: Array<{ lng: number; lat: number; stop: string; index: number; label: string }> = [];
          
          // Process stops sequentially (best practice for maintaining order)
          for (let i = 0; i < validStops.length; i++) {
            const stop = validStops[i];
            try {
              console.log(`MapboxMap: Geocoding stop ${i + 1}/${validStops.length}: ${stop}`);
              const [lng, lat] = await geocodeStop(stop);
              
              // Validate coordinates - check for default fallback coordinates
              if (isNaN(lng) || isNaN(lat) || (lng === 0 && lat === 0)) {
                console.warn(`MapboxMap: Invalid coordinates for stop ${i + 1}: ${stop}`, { lng, lat });
                // Continue to next stop instead of failing completely
                continue;
              }
              
              // Check if we got default fallback coordinates (indicates geocoding failed)
              if (lng === -96.9 && lat === 37.6) {
                console.warn(`MapboxMap: Geocoding returned default coordinates for stop ${i + 1}: ${stop} - skipping`);
                continue;
              }
              
              console.log(`MapboxMap: Successfully geocoded stop ${i + 1}: ${stop} -> [${lng}, ${lat}]`);
              
              // Determine marker color and label based on position
              const isFirst = i === 0;
              const isLast = i === validStops.length - 1;
              const color = isFirst 
                ? '#3b82f6' // Blue for pickup/origin
                : isLast 
                ? '#ef4444' // Red for delivery/destination
                : '#10b981'; // Green for intermediate stops

              const stopLabel = isFirst 
                ? 'Pickup' 
                : isLast 
                ? 'Delivery' 
                : `Stop ${i}`;

              // Create marker with proper configuration (best practice: use Mapbox GL JS Marker API)
              const marker = new mapboxgl.Marker({
                color,
                anchor: 'bottom', // Position marker bottom at coordinate
                clickTolerance: 3, // Default click tolerance
              })
                .setLngLat([lng, lat])
                .setPopup(
                  new mapboxgl.Popup({
                    offset: {
                      'bottom': [0, -10],
                      'bottom-left': [10, -10],
                      'bottom-right': [-10, -10],
                      'left': [10, 0],
                      'right': [-10, 0],
                      'top': [0, 10],
                      'top-left': [10, 10],
                      'top-right': [-10, 10],
                    },
                    maxWidth: '300px',
                    closeOnClick: true,
                    closeOnMove: false,
                    closeButton: true,
                    focusAfterOpen: true,
                  })
                    .setHTML(`
                      <div class="p-2">
                        <p class="font-semibold">${stopLabel}</p>
                        <p class="text-sm text-gray-600">${stop}</p>
                        <p class="text-xs text-gray-500 mt-1">${i + 1} of ${validStops.length}</p>
                      </div>
                    `)
                )
                .addTo(map);

              markersRef.current.push(marker);
              console.log(`MapboxMap: Added marker ${i + 1} (${stopLabel}) at [${lng}, ${lat}]`);
              
              // Store coordinate data with original index to preserve order
              coordinateData.push({ lng, lat, stop, index: i, label: stopLabel });
            } catch (error) {
              console.error(`MapboxMap: Failed to geocode stop ${i + 1}: ${stop}`, error);
              // Continue processing other stops even if one fails
            }
          }
          
          console.log(`MapboxMap: Successfully geocoded ${coordinateData.length} of ${validStops.length} stops`);
          
          if (coordinateData.length === 0) {
            console.error('MapboxMap: No valid coordinates after geocoding all stops');
            return;
          }

          // Coordinates are already in order (processed sequentially)
          // Best Practice: Mapbox Directions API expects waypoints in order: origin;waypoint1;waypoint2;...;destination
          const coordinates = coordinateData.map(c => [c.lng, c.lat] as [number, number]);
          
          console.log(`MapboxMap: Using ${coordinates.length} coordinates for route (in order):`, 
            coordinateData.map(c => `${c.label}: [${c.lng}, ${c.lat}]`));

          // Step 2: Fetch route from Mapbox Directions API
          // Best Practice: Directions API supports up to 25 waypoints per request
          // Format: origin;waypoint1;waypoint2;...;destination
          if (coordinates.length > 1) {
            try {
              // Best Practice: Build coordinates string in order: lng,lat;lng,lat;...
              // Mapbox respects the order: first is origin, last is destination, middle are waypoints
              let coordinatesString = coordinates.map(coord => `${coord[0]},${coord[1]}`).join(';');
              
              // Check waypoint limit (Mapbox Directions API supports max 25 waypoints)
              if (coordinates.length > 25) {
                console.warn(`MapboxMap: Route has ${coordinates.length} waypoints, but Directions API supports max 25. Using first 25.`);
                // Use first 25 waypoints (origin + 23 waypoints + destination)
                const limitedCoords = [
                  coordinates[0], // Origin
                  ...coordinates.slice(1, 24), // Middle waypoints
                  coordinates[coordinates.length - 1] // Destination
                ];
                coordinatesString = limitedCoords.map(coord => `${coord[0]},${coord[1]}`).join(';');
              }
              
              console.log(`MapboxMap: Fetching route for ${coordinates.length} waypoints (${coordinates.length <= 25 ? 'within limit' : 'limited to 25'})`);
              
              // Fetch route directly from Directions API
              // Best Practice: Use 'overview=full' for detailed route geometry, 'steps=false' for performance
              const directionsUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinatesString}?geometries=geojson&overview=full&steps=false&access_token=${mapboxgl.accessToken}`;
              
              console.log(`MapboxMap: Requesting route from Directions API...`);
              const response = await fetch(directionsUrl);
              
              console.log(`MapboxMap: Directions API response status: ${response.status}`);
              
              if (!response.ok) {
                const errorText = await response.text().catch(() => 'Unknown error');
                throw new Error(`Directions API error: ${response.status} ${response.statusText} - ${errorText}`);
              }
              
              const data = await response.json();
              
              console.log(`MapboxMap: Directions API response:`, {
                code: data.code,
                routesCount: data.routes?.length || 0,
                message: data.message,
                waypointCount: data.waypoints?.length || 0
              });
              
              if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
                const route = data.routes[0];
                const routeGeometry = route.geometry; // GeoJSON LineString
                
                console.log(`MapboxMap: Route found with ${routeGeometry.coordinates?.length || 0} coordinate points, distance: ${(route.distance / 1609.34).toFixed(1)} miles`);
                
                // Step 3: Add route as GeoJSON source (following guide's pattern)
                map.addSource('route', {
                  type: 'geojson',
                  data: {
                    type: 'Feature',
                    properties: {},
                    geometry: routeGeometry
                  }
                });

                // Step 4: Add route line layer (following guide's pattern)
                map.addLayer({
                  id: 'route',
                  type: 'line',
                  source: 'route',
                  layout: {
                    'line-join': 'round',
                    'line-cap': 'round'
                  },
                  paint: {
                    'line-color': '#0078FF', // Blue color as per guide
                    'line-width': 5, // Thicker line for visibility as per guide
                    'line-opacity': 0.9
                  }
                });

                // Step 5: Fit map to show all markers and route
                // Use marker coordinates to ensure all stops are visible
                const bounds = new mapboxgl.LngLatBounds();
                coordinates.forEach(([lng, lat]) => {
                  bounds.extend([lng, lat]);
                });
                
                // Also extend bounds with route coordinates to ensure full route is visible
                const routeCoords = routeGeometry.coordinates;
                if (routeCoords && routeCoords.length > 0) {
                  routeCoords.forEach((coord: [number, number]) => {
                    bounds.extend(coord);
                  });
                }
                
                console.log(`MapboxMap: Fitting bounds to show ${coordinates.length} markers and route`);
                map.fitBounds(bounds, {
                  padding: 50,
                  maxZoom: 12,
                  duration: 1000
                });
              } else {
                throw new Error('No route found in Directions API response');
              }
            } catch (error) {
              console.warn('Failed to fetch route from Directions API, using straight line:', error);
              // Fallback to straight line if Directions API fails
              map.addSource('route', {
                type: 'geojson',
                data: {
                  type: 'Feature',
                  properties: {},
                  geometry: {
                    type: 'LineString',
                    coordinates: coordinates
                  }
                }
              });

              map.addLayer({
                id: 'route',
                type: 'line',
                source: 'route',
                layout: {
                  'line-join': 'round',
                  'line-cap': 'round'
                },
                paint: {
                  'line-color': '#0078FF',
                  'line-width': 5,
                  'line-opacity': 0.9
                }
              });

              // Fit bounds to markers
              const bounds = new mapboxgl.LngLatBounds();
              coordinates.forEach(([lng, lat]) => {
                bounds.extend([lng, lat]);
              });
              map.fitBounds(bounds, {
                padding: 50,
                maxZoom: 12,
                duration: 1000
              });
            }
          } else if (coordinates.length === 1) {
            // Single marker - center on it
            map.setCenter(coordinates[0]);
            map.setZoom(10);
          }

          // Ensure map is visible and properly sized
          // CRITICAL: Check if map still exists and is valid before calling resize()
          if (map && typeof map.resize === 'function') {
            try {
              map.resize();
            } catch (resizeError) {
              console.warn('MapboxMap: Error resizing map (may be destroyed):', resizeError);
            }
          } else {
            console.warn('MapboxMap: Cannot resize map - map instance is not available');
          }
          
          // Final summary
          console.log(`MapboxMap: Map setup complete - ${markersRef.current.length} markers, ${coordinates.length} waypoints`);
        } catch (error) {
          console.error('MapboxMap: Error adding markers and route:', error);
        }
      });

      // Store stops key to detect changes
      (map as any)._lastStopsKey = stops.join('|');
      
      mapRef.current = map;
      setMapInstance(map);
      setIsInteractive(true);
      console.log('MapboxMap: Map initialized successfully', {
        containerSize: `${container.offsetWidth}x${container.offsetHeight}`,
        stopsCount: stops.length
      });
    } catch (error) {
      console.error('MapboxMap: Failed to load map:', error);
      setError(error instanceof Error ? error.message : 'Failed to load map');
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, hasMapboxToken, stops, theme, geocodeStop, mounted]);

  // Auto-load map when isInteractive becomes true and component is ready
  // Following guide: ensure map initializes only in browser, after mount, with proper dimensions
  // Critical for dialogs: wait for container to have dimensions AND be visible before initializing
  useEffect(() => {
    // Only run on client side (browser)
    if (typeof window === 'undefined') return;
    
    if (isInteractive && !isLoading && hasMapboxToken && mounted && mapContainerRef.current) {
      // For dialogs/modals, we need to wait for them to be fully rendered AND visible
      // Guide emphasizes: container must have defined height/width AND be visible
      const tryLoadMap = (attempts = 0) => {
        const container = mapContainerRef.current;
        if (!container) return;
        
        // Check if container is visible (not hidden by display:none or visibility:hidden)
        const computedStyle = window.getComputedStyle(container);
        const isVisible = computedStyle.display !== 'none' && 
                         computedStyle.visibility !== 'hidden' &&
                         computedStyle.opacity !== '0';
        
        // Check if container has valid dimensions (critical check)
        const hasDimensions = (container.offsetWidth > 0 || container.clientWidth > 0) && 
                             (container.offsetHeight > 0 || container.clientHeight > 0);
        
        if (hasDimensions && isVisible) {
          console.log('MapboxMap: Container ready, initializing map', {
            width: container.offsetWidth,
            height: container.offsetHeight,
            display: computedStyle.display,
            visibility: computedStyle.visibility,
            attempts
          });
          
          // If map already exists, check if we need to reload for new stops
          if (mapRef.current) {
            // Only reload if stops actually changed (avoid unnecessary reloads)
            const currentStopsKey = stops.join('|');
            const lastStopsKey = (mapRef.current as any)._lastStopsKey;
            
            if (currentStopsKey !== lastStopsKey && stops.length > 0) {
              // Stops changed - reload map
              markersRef.current.forEach(marker => marker.remove());
              markersRef.current = [];
              mapRef.current.remove();
              mapRef.current = null;
              setIsInteractive(false);
              
              // Small delay before reloading
              setTimeout(() => {
                setIsInteractive(true);
              }, 150);
              return;
            }
            // Map exists and stops haven't changed - ensure it's visible and resized
            // CRITICAL: Call resize() when dialog opens (per web search findings)
            setTimeout(() => {
              if (mapRef.current && typeof mapRef.current.resize === 'function') {
                try {
                  mapRef.current.resize();
                } catch (resizeError) {
                  console.warn('MapboxMap: Error resizing map on dialog open (may be destroyed):', resizeError);
                }
              }
            }, 100);
            return;
          }
          
          // Load new map if it doesn't exist
          if (!mapRef.current) {
            loadInteractiveMap();
          }
        } else if (attempts < 50) {
          // Retry up to 50 times (5 seconds total) for dialogs - more patience
          // This handles slow dialog animations
          setTimeout(() => tryLoadMap(attempts + 1), 100);
        } else {
          console.error('Map container still not ready after 50 retries. Container:', {
            width: container.offsetWidth,
            height: container.offsetHeight,
            clientWidth: container.clientWidth,
            clientHeight: container.clientHeight,
            display: computedStyle.display,
            visibility: computedStyle.visibility,
            opacity: computedStyle.opacity,
            computed: computedStyle
          });
        }
      };
      
      // Initial delay for dialog animation (longer for route maps in dialogs)
      // Guide: ensure container is fully rendered AND visible before initializing
      const timer = setTimeout(() => {
        tryLoadMap();
      }, lazy ? 200 : 500); // Even longer delay when not lazy (in dialogs)
      
      return () => clearTimeout(timer);
    }
  }, [isInteractive, hasMapboxToken, mounted, loadInteractiveMap, isLoading, stops, lazy]);

  // Resize map when container dimensions change (important for dialogs/modals)
  // CRITICAL: This handles dialog opening/closing and container size changes
  useEffect(() => {
    if (!mapRef.current || !mapContainerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      // When container size changes (e.g., dialog opens), resize the map
      for (const entry of entries) {
        if (entry.target === mapContainerRef.current && mapRef.current) {
          // Use requestAnimationFrame to ensure resize happens after layout
          requestAnimationFrame(() => {
            if (mapRef.current && typeof mapRef.current.resize === 'function') {
              try {
                mapRef.current.resize();
              } catch (resizeError) {
                console.warn('MapboxMap: Error resizing map on container resize (may be destroyed):', resizeError);
              }
            }
          });
        }
      }
    });

    resizeObserver.observe(mapContainerRef.current);

    // Also listen for dialog open events (Radix UI dialog)
    const handleDialogOpen = () => {
      if (mapRef.current) {
        // Multiple resize calls to ensure map renders in dialog
        setTimeout(() => {
          if (mapRef.current && typeof mapRef.current.resize === 'function') {
            try {
              mapRef.current.resize();
            } catch (resizeError) {
              console.warn('MapboxMap: Error resizing map on dialog open (first attempt, may be destroyed):', resizeError);
            }
          }
        }, 100);
        setTimeout(() => {
          if (mapRef.current && typeof mapRef.current.resize === 'function') {
            try {
              mapRef.current.resize();
            } catch (resizeError) {
              console.warn('MapboxMap: Error resizing map on dialog open (second attempt, may be destroyed):', resizeError);
            }
          }
        }, 300);
      }
    };

    // Listen for dialog state changes
    const dialogContent = mapContainerRef.current.closest('[role="dialog"]');
    if (dialogContent) {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'attributes' && mutation.attributeName === 'data-state') {
            const state = (mutation.target as HTMLElement).getAttribute('data-state');
            if (state === 'open') {
              handleDialogOpen();
            }
          }
        });
      });
      observer.observe(dialogContent, { attributes: true, attributeFilter: ['data-state'] });
      
      return () => {
        resizeObserver.disconnect();
        observer.disconnect();
      };
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [mapRef.current, mapContainerRef.current]);

  // Cleanup map on unmount
  useEffect(() => {
    return () => {
      markersRef.current.forEach(marker => marker.remove());
      markersRef.current = [];
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Generate static map image URL (cheaper than GL JS for previews)
  // Using v11 style (Standard style may require newer SDK version)
  const getStaticMapUrl = useCallback((stops: string[]): string => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || 
                  process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    
    if (!token || stops.length === 0) return '';

    // Use light v11 style for static images (matches theme)
    const style = theme === "dark" ? "dark-v11" : "light-v11";
    return `https://api.mapbox.com/styles/v1/mapbox/${style}/static/-96.9,37.6,6/600x300@2x?access_token=${token}`;
  }, [theme]);

  if (!mounted) {
    return (
      <div className={`relative ${className}`}>
        <div 
          className="w-full h-full rounded-lg overflow-hidden border border-border/40 bg-muted/50"
          style={{ minHeight }}
        />
      </div>
    );
  }

  if (!hasMapboxToken) {
    // Placeholder when no token
    return (
      <div className={`relative ${className}`}>
        <div 
          className="w-full h-full rounded-lg overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-800 dark:to-slate-900 border border-border/40"
          style={{ minHeight }}
        >
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <MapPin className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Interactive Route Map</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Map will show pickup, stops, and delivery locations
                </p>
                <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
                  <p className="font-medium mb-2">To enable the map:</p>
                  <p>1. Get a Mapbox access token from mapbox.com</p>
                  <p>2. Add NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN to .env.local</p>
                  <p>3. Restart the application</p>
                </div>
              </div>
            </div>
            
            {/* Route visualization placeholder */}
            {stops.length > 0 && (
            <div className="mt-6 w-full max-w-md">
              <div className="space-y-3">
                {stops.map((stop, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 bg-white/60 dark:bg-surface-800/60 rounded-lg backdrop-blur-sm border border-white/20">
                    <div className={`flex items-center justify-center w-8 h-8 rounded-full text-white text-sm font-bold ${
                      index === 0 ? 'bg-blue-500' : 
                      index === stops.length - 1 ? 'bg-red-500' : 
                      'bg-green-500'
                    }`}>
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm text-foreground">{stop}</p>
                      <p className="text-xs text-muted-foreground">
                        {index === 0 ? 'Pickup Location' : 
                         index === stops.length - 1 ? 'Delivery Location' : 
                         `Stop ${index}`}
                      </p>
                    </div>
                    {index < stops.length - 1 && (
                      <Navigation className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                ))}
              </div>
            </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Lazy loading: Show static preview first, load interactive on click
  if (lazy && !isInteractive && isVisible) {
    const staticMapUrl = getStaticMapUrl(stops);
    
  return (
    <div className={`relative ${className}`}>
      <div 
          ref={mapContainerRef}
          className="w-full h-full rounded-lg overflow-hidden border border-border/40 relative group cursor-pointer"
          style={{ minHeight }}
          onClick={() => setIsInteractive(true)}
        >
          {staticMapUrl ? (
            <img 
              src={staticMapUrl} 
              alt="Route map preview" 
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center">
        <div className="text-center space-y-2">
          <MapPin className="w-8 h-8 text-muted-foreground mx-auto" />
                <p className="text-sm text-muted-foreground">Click to load interactive map</p>
              </div>
            </div>
          )}
          
          {/* Overlay with click hint */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors flex items-center justify-center">
            <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-lg px-4 py-2 border border-border shadow-lg flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <ZoomIn className="w-4 h-4" />
              <span className="text-sm font-medium">Click to load interactive map</span>
            </div>
          </div>

          {/* Route stops list overlay */}
          {stops.length > 0 && (
            <div className="absolute bottom-4 left-4 right-4">
              <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-lg p-3 border border-border shadow-lg">
                <div className="flex items-center gap-2 flex-wrap">
                  {stops.slice(0, 3).map((stop, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        index === 0 ? 'bg-blue-500' : 
                        index === stops.length - 1 ? 'bg-red-500' : 
                        'bg-green-500'
                      }`} />
                      <span className="text-xs font-medium">{stop}</span>
                    </div>
                  ))}
                  {stops.length > 3 && (
                    <span className="text-xs text-muted-foreground">+{stops.length - 3} more</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className={`relative ${className}`}>
        <div 
          className="w-full h-full rounded-lg overflow-hidden border border-border/40 bg-muted/50 flex items-center justify-center"
          style={{ minHeight }}
        >
          <div className="text-center space-y-3">
            <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
            <p className="text-sm text-muted-foreground">Loading interactive map...</p>
          </div>
        </div>
      </div>
    );
  }

  // Interactive map container
  return (
    <div className={`relative ${className}`} style={{ minHeight, width: '100%', height: '100%' }}>
      <div 
        ref={mapContainerRef}
        className="w-full h-full rounded-lg overflow-hidden border border-border/40"
        style={{ 
          width: '100%', 
          height: '100%', 
          minHeight,
          position: 'relative',
          backgroundColor: '#f3f4f6' // Light gray background to show container exists
        }}
      />
      
      {/* Loading indicator */}
      {isInteractive && isLoading && (
        <div className="absolute inset-0 bg-black/10 flex items-center justify-center rounded-lg z-10">
          <div className="bg-white dark:bg-slate-800 rounded-lg p-4 flex items-center gap-3 shadow-lg">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span className="text-sm font-medium">Loading map...</span>
          </div>
        </div>
      )}
      
      {/* Debug info - Admin only, toggleable */}
      {isAdmin && mapContainerRef.current && (
        <>
          {/* Toggle button for debug box */}
          <button
            onClick={() => setShowDebugBox(!showDebugBox)}
            className="absolute top-2 left-2 bg-yellow-500 hover:bg-yellow-600 dark:bg-yellow-600 dark:hover:bg-yellow-700 text-white rounded-full p-2 z-20 shadow-lg transition-colors"
            aria-label="Toggle debug info"
            title="Toggle debug info"
          >
            {showDebugBox ? (
              <X className="w-4 h-4" />
            ) : (
              <Bug className="w-4 h-4" />
            )}
          </button>
          
          {/* Debug box - only show if toggled on */}
          {showDebugBox && (
            <div className="absolute top-2 left-12 bg-yellow-100 dark:bg-yellow-900/30 text-xs p-3 rounded z-20 shadow-lg border border-yellow-300 dark:border-yellow-700 pointer-events-auto">
              <div className="font-semibold mb-2 text-yellow-800 dark:text-yellow-200">Debug Info</div>
              <div className="space-y-1 text-yellow-900 dark:text-yellow-100">
                <div>Interactive: {isInteractive ? 'Yes' : 'No'}</div>
                <div>Loading: {isLoading ? 'Yes' : 'No'}</div>
                <div>Has Map: {mapRef.current ? 'Yes' : 'No'}</div>
                <div>Has Token: {hasMapboxToken ? 'Yes' : 'No'}</div>
                <div>Mounted: {mounted ? 'Yes' : 'No'}</div>
                <div>Stops: {stops.length}</div>
                <div>Size: {mapContainerRef.current.offsetWidth}x{mapContainerRef.current.offsetHeight}</div>
              </div>
            </div>
          )}
        </>
      )}
      
      {/* Map controls overlay */}
      {isInteractive && mapInstance && stops.length > 0 && (
        <div className="absolute top-4 right-4 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-lg p-2 border border-border shadow-lg z-10">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Truck className="w-4 h-4" />
            <span>{stops.length} {stops.length === 1 ? 'location' : 'locations'}</span>
          </div>
        </div>
      )}
      
      {/* Custom Attribution Button - Bottom Right */}
      {isInteractive && mapInstance && (
        <Popover open={attributionOpen} onOpenChange={setAttributionOpen}>
          <PopoverTrigger asChild>
            <button
              className="absolute bottom-2 right-2 z-10 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-full p-2 border border-border shadow-lg hover:bg-white dark:hover:bg-slate-800 transition-colors"
              aria-label="Map attribution"
            >
              <Info className="w-4 h-4 text-muted-foreground" />
            </button>
          </PopoverTrigger>
          <PopoverContent 
            side="top" 
            align="end" 
            className="w-64 p-3 text-xs"
          >
            <div className="space-y-2">
              <p className="font-semibold text-sm mb-2">Map Attribution</p>
              <p className="text-muted-foreground">
                © <a href="https://www.mapbox.com/about/maps/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Mapbox</a>
              </p>
              <p className="text-muted-foreground">
                © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">OpenStreetMap</a>
              </p>
              <p className="text-muted-foreground">
                <a href="https://www.mapbox.com/map-feedback/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Improve this map</a>
              </p>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
