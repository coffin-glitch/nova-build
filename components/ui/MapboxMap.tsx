"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { MapPin, Navigation, Truck, ZoomIn, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
}

export function MapboxMap({ 
  stops, 
  className = "",
  lazy = true,
  minHeight = "300px"
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
  const geocodeStop = useCallback(async (stop: string): Promise<[number, number]> => {
    try {
      // Use the geocoding utility with caching
      const { geocodeLocation } = await import('@/lib/mapbox-geocode');
      const result = await geocodeLocation(stop, false); // false = use approximations first (cheaper)
      return [result.lng, result.lat];
    } catch (error) {
      console.warn(`Geocoding failed for ${stop}:`, error);
      // Default to US center
      return [-96.9, 37.6];
    }
  }, []);

  // Load interactive map - fixed implementation
  const loadInteractiveMap = useCallback(async () => {
    if (isInteractive || isLoading || !hasMapboxToken || !mapContainerRef.current || !mounted) return;

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

      // Ensure container is ready and has dimensions
      if (!mapContainerRef.current) {
        throw new Error('Map container not ready');
      }

      // Wait for container to have dimensions (important for dialogs/modals)
      const container = mapContainerRef.current;
      if (container.offsetWidth === 0 || container.offsetHeight === 0) {
        // Retry after a short delay if container has no dimensions
        setTimeout(() => {
          if (container.offsetWidth > 0 && container.offsetHeight > 0) {
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
        // Attribution
        attributionControl: true,
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
      map.on('load', async () => {
        try {
          // Resize map to ensure it displays correctly (important for dialogs)
          map.resize();

          // Clear existing markers
          markersRef.current.forEach(marker => marker.remove());
          markersRef.current = [];

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

          // Add markers for all stops
          const markerPromises = validStops.map(async (stop, i) => {
            try {
              const [lng, lat] = await geocodeStop(stop);
              
              // Validate coordinates
              if (isNaN(lng) || isNaN(lat) || lng === 0 && lat === 0) {
                console.warn(`Invalid coordinates for stop ${i}: ${stop}`);
                return null;
              }
              
              const color = i === 0 
                ? '#3b82f6' // Blue for pickup
                : i === validStops.length - 1 
                ? '#ef4444' // Red for delivery
                : '#10b981'; // Green for stops

              // Configure marker with proper options per Mapbox GL JS docs
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
                        <p class="font-semibold">${i === 0 ? 'Pickup' : i === validStops.length - 1 ? 'Delivery' : `Stop ${i}`}</p>
                        <p class="text-sm text-gray-600">${stop}</p>
                      </div>
                    `)
                )
                .addTo(map);

              markersRef.current.push(marker);
              return { lng, lat };
            } catch (error) {
              console.warn(`Failed to geocode stop ${i}: ${stop}`, error);
              return null;
            }
          });

          const coordinates = (await Promise.all(markerPromises)).filter(Boolean) as Array<[number, number]>;
          
          if (coordinates.length === 0) {
            console.warn('No valid coordinates after geocoding');
            return;
          }

          // Add route line if we have multiple stops
          if (coordinates.length > 1) {
            // Remove existing route source/layer if present
            if (map.getSource('route')) {
              if (map.getLayer('route')) {
                map.removeLayer('route');
              }
              map.removeSource('route');
            }

            // Try to get optimal route using Mapbox Directions API
            try {
              const { getOptimalRoute, routeToGeoJSON } = await import('@/lib/mapbox-directions');
              const waypoints = coordinates.map((coord, i) => ({
                coordinates: coord,
                name: validStops[i] || `Stop ${i + 1}`
              }));

              const route = await getOptimalRoute(waypoints, {
                profile: 'driving',
                geometries: 'geojson',
                overview: 'full',
              });

              if (route) {
                // Use optimized route from Directions API
                const routeGeoJSON = routeToGeoJSON(route);
                map.addSource('route', {
                  type: 'geojson',
                  data: routeGeoJSON
                });
              } else {
                // Fallback to straight line if Directions API fails
                map.addSource('route', {
                  type: 'geojson',
                  data: {
                    type: 'Feature',
                    properties: {},
                    geometry: {
                      type: 'LineString',
                      coordinates: coordinates.map(c => [c[0], c[1]])
                    }
                  }
                });
              }
            } catch (error) {
              console.warn('Failed to get optimal route, using straight line:', error);
              // Fallback to straight line
              map.addSource('route', {
                type: 'geojson',
                data: {
                  type: 'Feature',
                  properties: {},
                  geometry: {
                    type: 'LineString',
                    coordinates: coordinates.map(c => [c[0], c[1]])
                  }
                }
              });
            }

            map.addLayer({
              id: 'route',
              type: 'line',
              source: 'route',
              layout: {
                'line-join': 'round',
                'line-cap': 'round'
              },
              paint: {
                'line-color': '#3b82f6',
                'line-width': 4,
                'line-opacity': 0.75
              }
            });

            // Fit bounds to show all markers and route
            const bounds = new mapboxgl.LngLatBounds();
            coordinates.forEach(([lng, lat]) => {
              bounds.extend([lng, lat]);
            });
            
            // Ensure we have valid bounds before fitting
            if (bounds.getNorth() !== bounds.getSouth() || bounds.getEast() !== bounds.getWest()) {
              map.fitBounds(bounds, {
                padding: 50,
                maxZoom: 12,
                duration: 1000, // Smooth animation
              });
            } else {
              // Single point - just center on it
              map.setCenter(coordinates[0]);
              map.setZoom(10);
            }
          } else if (coordinates.length === 1) {
            // Single marker - center on it
            map.setCenter(coordinates[0]);
            map.setZoom(10);
          }

          // Ensure map is visible
          map.resize();
        } catch (error) {
          console.error('Error adding markers:', error);
        }
      });

      mapRef.current = map;
      setMapInstance(map);
      setIsInteractive(true);
    } catch (error) {
      console.error('Failed to load Mapbox map:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isInteractive, isLoading, hasMapboxToken, stops, theme, geocodeStop, mounted]);

  // Auto-load map when isInteractive becomes true and component is ready
  // Add a small delay for dialogs to ensure container has dimensions
  useEffect(() => {
    if (isInteractive && !isLoading && hasMapboxToken && mounted && mapContainerRef.current && !mapRef.current) {
      // For dialogs/modals, we need to wait for them to be fully rendered
      // Use a more robust check with retry logic
      const tryLoadMap = (attempts = 0) => {
        const container = mapContainerRef.current;
        if (!container) return;
        
        // Check if container has valid dimensions
        if (container.offsetWidth > 0 && container.offsetHeight > 0) {
          loadInteractiveMap();
        } else if (attempts < 10) {
          // Retry up to 10 times (1 second total wait time)
          setTimeout(() => tryLoadMap(attempts + 1), 100);
        } else {
          console.warn('Map container still has no dimensions after retries');
        }
      };
      
      // Initial delay for dialog animation
      const timer = setTimeout(() => {
        tryLoadMap();
      }, 200);
      
      return () => clearTimeout(timer);
    }
  }, [isInteractive, hasMapboxToken, mounted, loadInteractiveMap, isLoading, stops]);

  // Resize map when container dimensions change (important for dialogs/modals)
  useEffect(() => {
    if (!mapRef.current || !mapContainerRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      if (mapRef.current) {
        // Small delay to ensure container has finished resizing
        setTimeout(() => {
          mapRef.current?.resize();
        }, 100);
      }
    });

    resizeObserver.observe(mapContainerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [mapRef.current]);

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
    <div className={`relative ${className}`} style={{ minHeight }}>
      <div 
        ref={mapContainerRef}
        className="w-full h-full rounded-lg overflow-hidden border border-border/40"
        style={{ width: '100%', height: '100%', minHeight }}
      />
      
      {/* Map controls overlay */}
      {isInteractive && mapInstance && stops.length > 0 && (
        <div className="absolute top-4 right-4 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-lg p-2 border border-border shadow-lg">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Truck className="w-4 h-4" />
            <span>{stops.length} {stops.length === 1 ? 'location' : 'locations'}</span>
          </div>
        </div>
      )}
    </div>
  );
}
