"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { MapPin, Navigation, Truck, ZoomIn, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import MapProvider from "@/lib/mapbox/provider";
import { useMap } from "@/context/map-context";
import mapboxgl from "mapbox-gl";

interface MapboxMapProps {
  stops: string[];
  className?: string;
  lazy?: boolean;
  minHeight?: string;
}

// Internal component that uses the map context
function MapContent({ stops, minHeight }: { stops: string[]; minHeight: string }) {
  const { map } = useMap();
  const markersRef = useRef<any[]>([]);

  // Geocode a stop location
  const geocodeStop = useCallback(async (stop: string): Promise<[number, number]> => {
    try {
      const { geocodeLocation } = await import('@/lib/mapbox-geocode');
      const result = await geocodeLocation(stop, false);
      return [result.lng, result.lat];
    } catch (error) {
      console.warn(`Geocoding failed for ${stop}:`, error);
      return [-96.9, 37.6];
    }
  }, []);

  // Add markers and route when map loads
  useEffect(() => {
    if (!map || stops.length === 0) return;

    const addMarkersAndRoute = async () => {
      try {
        // Clear existing markers
        markersRef.current.forEach(marker => marker.remove());
        markersRef.current = [];

        // Add markers for all stops
        const markerPromises = stops.map(async (stop, i) => {
          try {
            const [lng, lat] = await geocodeStop(stop);
            
            const color = i === 0 
              ? '#3b82f6' // Blue for pickup
              : i === stops.length - 1 
              ? '#ef4444' // Red for delivery
              : '#10b981'; // Green for stops

            const marker = new mapboxgl.Marker({ color })
              .setLngLat([lng, lat])
              .setPopup(
                new mapboxgl.Popup({ offset: 25 })
                  .setHTML(`
                    <div class="p-2">
                      <p class="font-semibold">${i === 0 ? 'Pickup' : i === stops.length - 1 ? 'Delivery' : `Stop ${i}`}</p>
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

        // Add route line if we have multiple stops
        if (coordinates.length > 1) {
          // Remove existing route if present
          if (map.getSource('route')) {
            if (map.getLayer('route')) {
              map.removeLayer('route');
            }
            map.removeSource('route');
          }

          // Add route line
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
          map.fitBounds(bounds, {
            padding: 50,
            maxZoom: 12,
          });
        } else if (coordinates.length === 1) {
          // Single marker - center on it
          map.setCenter(coordinates[0]);
          map.setZoom(10);
        }

        map.resize();
      } catch (error) {
        console.error('Error adding markers:', error);
      }
    };

    // Wait for map to be fully loaded
    if (map.loaded()) {
      addMarkersAndRoute();
    } else {
      map.once('load', addMarkersAndRoute);
    }

    return () => {
      markersRef.current.forEach(marker => marker.remove());
      markersRef.current = [];
      if (map.getSource('route')) {
        if (map.getLayer('route')) {
          map.removeLayer('route');
        }
        map.removeSource('route');
      }
    };
  }, [map, stops, geocodeStop]);

  return null; // This component doesn't render anything, it just manages map content
}

export function MapboxMap({ 
  stops, 
  className = "",
  lazy = true,
  minHeight = "300px"
}: MapboxMapProps) {
  const [hasMapboxToken, setHasMapboxToken] = useState(false);
  const [isInteractive, setIsInteractive] = useState(!lazy);
  const [mounted, setMounted] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(!lazy);

  useEffect(() => {
    setMounted(true);
    const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || 
                  process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    setHasMapboxToken(!!token);
  }, []);

  // Intersection Observer for lazy loading
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
      { threshold: 0.1 }
    );

    observer.observe(mapContainerRef.current);
    return () => observer.disconnect();
  }, [lazy, mounted]);

  // Get initial center from first stop
  const getInitialCenter = useCallback(async () => {
    if (stops.length === 0) return { longitude: -96.9, latitude: 37.6, zoom: 6 };
    
    try {
      const { geocodeLocation } = await import('@/lib/mapbox-geocode');
      const result = await geocodeLocation(stops[0], false);
      return { longitude: result.lng, latitude: result.lat, zoom: 6 };
    } catch {
      return { longitude: -96.9, latitude: 37.6, zoom: 6 };
    }
  }, [stops]);

  const [initialViewState, setInitialViewState] = useState({ longitude: -96.9, latitude: 37.6, zoom: 6 });

  useEffect(() => {
    getInitialCenter().then(setInitialViewState);
  }, [getInitialCenter]);

  // Generate static map image URL
  const getStaticMapUrl = useCallback((): string => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || 
                  process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token || stops.length === 0) return '';
    const style = "light-v11";
    return `https://api.mapbox.com/styles/v1/mapbox/${style}/static/-96.9,37.6,6/600x300@2x?access_token=${token}`;
  }, [stops]);

  if (!mounted) {
    return (
      <div className={`relative ${className}`} style={{ minHeight }}>
        <div className="w-full h-full rounded-lg overflow-hidden border border-border/40 bg-muted/50" />
      </div>
    );
  }

  if (!hasMapboxToken) {
    return (
      <div className={`relative ${className}`} style={{ minHeight }}>
        <div className="w-full h-full rounded-lg overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-800 dark:to-slate-900 border border-border/40 flex items-center justify-center">
          <div className="text-center space-y-4 p-6">
            <MapPin className="w-12 h-12 text-primary mx-auto" />
            <div>
              <h3 className="text-lg font-semibold mb-2">Interactive Route Map</h3>
              <p className="text-sm text-muted-foreground">
                Add NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN to .env.local
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Lazy loading: Show static preview first
  if (lazy && !isInteractive && isVisible) {
    const staticMapUrl = getStaticMapUrl();
    
    return (
      <div className={`relative ${className}`} style={{ minHeight }}>
        <div 
          ref={mapContainerRef}
          className="w-full h-full rounded-lg overflow-hidden border border-border/40 relative group cursor-pointer"
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
          
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors flex items-center justify-center">
            <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-lg px-4 py-2 border border-border shadow-lg flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <ZoomIn className="w-4 h-4" />
              <span className="text-sm font-medium">Click to load interactive map</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Interactive map
  if (isInteractive && isVisible) {
    return (
      <div className={`relative ${className}`} style={{ minHeight }}>
        <div 
          ref={mapContainerRef}
          className="w-full h-full rounded-lg overflow-hidden border border-border/40"
          style={{ width: '100%', height: '100%', minHeight }}
        />
        <MapProvider
          mapContainerRef={mapContainerRef}
          initialViewState={initialViewState}
        >
          <MapContent stops={stops} minHeight={minHeight} />
          {stops.length > 0 && (
            <div className="absolute top-4 right-4 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-lg p-2 border border-border shadow-lg z-10">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Truck className="w-4 h-4" />
                <span>{stops.length} {stops.length === 1 ? 'location' : 'locations'}</span>
              </div>
            </div>
          )}
        </MapProvider>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} style={{ minHeight }}>
      <div className="w-full h-full rounded-lg overflow-hidden border border-border/40 bg-muted/50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    </div>
  );
}

