"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Loader2, MapPin } from "lucide-react";
import { useTheme } from "next-themes";
import { splitCityState } from "@/lib/geo";

interface Bid {
  bid_number: string;
  stops?: string | string[] | null;
  origin_city?: string;
  origin_state?: string;
  destination_city?: string;
  destination_state?: string;
  is_expired?: boolean;
  [key: string]: any;
}

interface LiveMapViewProps {
  bids: Bid[];
  className?: string;
  onMarkerClick?: (bid: Bid) => void;
}

export function LiveMapView({ bids, className = "", onMarkerClick }: LiveMapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const { theme } = useTheme();
  const [isLoading, setIsLoading] = useState(false);
  const [hasMapboxToken, setHasMapboxToken] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || 
                  process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    setHasMapboxToken(!!token);
  }, []);

  // Parse stops from bid
  const parseStops = useCallback((stops: string | string[] | null): string[] => {
    if (!stops) return [];
    if (Array.isArray(stops)) return stops;
    if (typeof stops === 'string') {
      try {
        const parsed = JSON.parse(stops);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        return [stops];
      }
    }
    return [];
  }, []);

  // Get location string from bid - use origin/pickup location for marker positioning
  // Following Mapbox tutorial best practices: use specific city, state format for accurate geocoding
  const getBidLocation = useCallback((bid: Bid): string | null => {
    // Priority: origin city/state (most accurate) > first stop with state extraction > destination
    if (bid.origin_city && bid.origin_state) {
      // Format: "City, State" for best geocoding accuracy
      return `${bid.origin_city.trim()}, ${bid.origin_state.trim()}`;
    }
    
    // Try to extract city and state from first stop
    const stops = parseStops(bid.stops);
    if (stops.length > 0) {
      const firstStop = stops[0];
      // Check if stop already has "City, State" format (e.g., "PALMETTO, GA")
      if (firstStop.includes(',') && firstStop.match(/,\s*[A-Z]{2}$/)) {
        return firstStop.trim();
      }
      // Try to extract city and state from stop string
      const { city, state } = splitCityState(firstStop);
      if (city && state) {
        return `${city}, ${state}`;
      }
      // Fallback to full stop string
      return firstStop.trim();
    }
    
    // Fallback to destination
    if (bid.destination_city && bid.destination_state) {
      return `${bid.destination_city.trim()}, ${bid.destination_state.trim()}`;
    }
    return null;
  }, [parseStops]);

  // Geocode location - use API for accurate positioning (per Mapbox tutorial)
  const geocodeLocation = useCallback(async (location: string): Promise<[number, number] | null> => {
    if (!location || !location.trim()) return null;
    
    try {
      const { geocodeLocation: geocode } = await import('@/lib/mapbox-geocode');
      // Use API geocoding (useApi: true) for accurate marker positioning
      // This ensures markers appear at actual city locations, not state centers
      const result = await geocode(location.trim(), true); // true = use API
      return [result.lng, result.lat];
    } catch (error) {
      console.warn(`Geocoding failed for ${location}:`, error);
      return null;
    }
  }, []);

  // Initialize map
  const initializeMap = useCallback(async () => {
    if (!mapContainerRef.current || !hasMapboxToken || mapRef.current || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const mapboxgl = (await import('mapbox-gl')).default;
      await import('mapbox-gl/dist/mapbox-gl.css');

      const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || 
                    process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
      
      if (!token) {
        throw new Error('Mapbox token not found');
      }

      mapboxgl.accessToken = token;

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

      const container = mapContainerRef.current;
      if (container.offsetWidth === 0 || container.offsetHeight === 0) {
        // Retry after a short delay if container has no dimensions
        setTimeout(() => {
          if (container.offsetWidth > 0 && container.offsetHeight > 0) {
            initializeMap();
          }
        }, 100);
        return;
      }

      // Configure map with proper options per Mapbox GL JS docs
      const map = new mapboxgl.Map({
        container: container,
        style: mapStyle,
        center: [-96.9, 37.6], // US center
        zoom: 4,
        minZoom: 3,
        maxZoom: 15,
        pitch: 0,
        bearing: 0,
        // Interaction options
        clickTolerance: 3,
        boxZoom: true,
        doubleClickZoom: true,
        dragPan: true,
        dragRotate: true,
        keyboard: true,
        scrollZoom: true,
        touchPitch: true,
        touchZoomRotate: true,
        // Performance options
        trackResize: true,
        renderWorldCopies: true,
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

      // Handle style loading errors with better logging
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
        }
        // Silently ignore empty errors - they're often non-critical Mapbox internal events
      });

      mapRef.current = map;

      // Wait for map to load, then add markers
      map.on('load', async () => {
        // Resize map to ensure it displays correctly
        map.resize();
        await updateMarkers(bids, map);
        setIsLoading(false);
      });

    } catch (err) {
      console.error('Failed to initialize map:', err);
      setError(err instanceof Error ? err.message : 'Failed to load map');
      setIsLoading(false);
    }
  }, [hasMapboxToken, theme, bids]);

  // Update markers when bids change with clustering support
  const updateMarkers = useCallback(async (bidsData: Bid[], map: any) => {
    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    if (!map || bidsData.length === 0) return;

    const coordinates: Array<[number, number]> = [];
    
    // Group bids by location (for clustering)
    const locationGroups = new Map<string, { coords: [number, number], bids: Bid[] }>();
    const CLUSTER_DISTANCE = 0.01; // ~1km radius for clustering

    // First pass: geocode all locations
    for (const bid of bidsData) {
      const location = getBidLocation(bid);
      if (!location) continue;

      const coords = await geocodeLocation(location);
      if (!coords) continue;

      const [lng, lat] = coords;
      
      // Check if this location is close to an existing cluster
      let foundCluster = false;
      for (const [key, group] of locationGroups.entries()) {
        const [groupLng, groupLat] = group.coords;
        const distance = Math.sqrt(
          Math.pow(lng - groupLng, 2) + Math.pow(lat - groupLat, 2)
        );
        
        if (distance < CLUSTER_DISTANCE) {
          group.bids.push(bid);
          foundCluster = true;
          break;
        }
      }
      
      if (!foundCluster) {
        locationGroups.set(`${lng},${lat}`, { coords: [lng, lat], bids: [bid] });
      }
    }

    // Second pass: create markers (clustered or individual)
    for (const [key, group] of locationGroups.entries()) {
      const [lng, lat] = group.coords;
      const bids = group.bids;
      coordinates.push([lng, lat]);

      const isCluster = bids.length > 1;
      const activeCount = bids.filter(b => !b.is_expired).length;
      const expiredCount = bids.filter(b => b.is_expired).length;
      
      // Determine color based on bid status (use active if any active)
      const hasActive = activeCount > 0;
      const color = hasActive ? '#10b981' : '#ef4444'; // Green for active, red for expired

      let popupContent = '';
      
      if (isCluster) {
        // Clustered marker popup with detailed bid information
        const clusterLocation = getBidLocation(bids[0]);
        
        // Helper to get route summary from bid
        const getRouteSummary = (bid: Bid) => {
          const stops = parseStops(bid.stops);
          if (stops.length >= 2) {
            return `${stops[0]} → ${stops[stops.length - 1]}`;
          }
          return stops[0] || 'Route info unavailable';
        };
        
        // Helper to get distance
        const getDistance = (bid: Bid) => {
          if (bid.distance_miles) {
            return `${Math.round(bid.distance_miles)} mi`;
          }
          return 'N/A';
        };
        
        popupContent = `
          <div class="p-4 min-w-[320px] max-w-[400px]">
            <div class="mb-3">
              <p class="font-bold text-base mb-1">${bids.length} Bid${bids.length > 1 ? 's' : ''} in ${clusterLocation || 'Location'}</p>
              <div class="flex items-center gap-2">
                <span class="text-xs px-2 py-1 rounded bg-green-100 text-green-700 font-medium">
                  ${activeCount} Active
                </span>
                ${expiredCount > 0 ? `<span class="text-xs px-2 py-1 rounded bg-red-100 text-red-700 font-medium">${expiredCount} Expired</span>` : ''}
              </div>
            </div>
            <div class="space-y-2 max-h-64 overflow-y-auto border-t border-gray-200 pt-2">
              ${bids.map((bid, idx) => `
                <div class="bg-gray-50 rounded-lg p-2.5 border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-colors" data-bid-number="${bid.bid_number}">
                  <div class="flex items-start justify-between mb-1.5">
                    <div class="flex-1">
                      <div class="flex items-center gap-2 mb-1">
                        <span class="font-bold text-sm text-gray-900">#${bid.bid_number}</span>
                        <span class="text-xs px-1.5 py-0.5 rounded ${
                          bid.is_expired 
                            ? 'bg-red-100 text-red-700' 
                            : 'bg-green-100 text-green-700'
                        } font-medium">
                          ${bid.is_expired ? 'Expired' : 'Active'}
                        </span>
                      </div>
                      <p class="text-xs text-gray-600 mb-1 line-clamp-1">${getRouteSummary(bid)}</p>
                      <div class="flex items-center gap-3 text-xs text-gray-500">
                        <span>${getDistance(bid)}</span>
                        ${bid.bids_count ? `<span>${bid.bids_count} bid${bid.bids_count > 1 ? 's' : ''}</span>` : ''}
                      </div>
                    </div>
                    ${onMarkerClick ? `
                      <button 
                        class="ml-2 p-1.5 rounded-md bg-blue-500 text-white hover:bg-blue-600 transition-colors flex items-center justify-center"
                        onclick="window.handleBidClick && window.handleBidClick('${bid.bid_number}'); event.stopPropagation();"
                        title="View Details"
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                        </svg>
                      </button>
                    ` : ''}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      } else {
        // Single marker popup with detailed information
        const bid = bids[0];
        const stops = parseStops(bid.stops);
        const routeSummary = stops.length >= 2 
          ? `${stops[0]} → ${stops[stops.length - 1]}`
          : stops[0] || 'Route info unavailable';
        const distance = bid.distance_miles 
          ? `${Math.round(bid.distance_miles)} mi`
          : 'N/A';
        
        popupContent = `
          <div class="p-3 min-w-[280px]">
            <div class="mb-2">
              <p class="font-bold text-base mb-1">Bid #${bid.bid_number}</p>
              <div class="flex items-center gap-2 mb-2">
                <span class="text-xs px-2 py-1 rounded ${
                  bid.is_expired 
                    ? 'bg-red-100 text-red-700' 
                    : 'bg-green-100 text-green-700'
                } font-medium">
                  ${bid.is_expired ? 'Expired' : 'Active'}
                </span>
              </div>
            </div>
            <div class="space-y-1.5 mb-3 text-xs">
              <div class="flex items-center gap-2">
                <span class="text-gray-500">Route:</span>
                <span class="font-medium text-gray-900">${routeSummary}</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-gray-500">Distance:</span>
                <span class="font-medium text-gray-900">${distance}</span>
              </div>
              ${bid.bids_count ? `
                <div class="flex items-center gap-2">
                  <span class="text-gray-500">Bids:</span>
                  <span class="font-medium text-gray-900">${bid.bids_count}</span>
                </div>
              ` : ''}
              ${stops.length > 0 ? `
                <div class="flex items-center gap-2">
                  <span class="text-gray-500">Stops:</span>
                  <span class="font-medium text-gray-900">${stops.length}</span>
                </div>
              ` : ''}
            </div>
            ${onMarkerClick ? `
              <button 
                class="text-xs px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors w-full font-medium"
                onclick="window.handleSingleBidClick && window.handleSingleBidClick('${bid.bid_number}'); event.stopPropagation();"
              >
                View Full Details →
              </button>
            ` : ''}
          </div>
        `;
      }

      // Create marker element
      const markerEl = document.createElement('div');
      markerEl.className = 'custom-marker';
      
      if (isCluster) {
        // Clustered marker with count badge
        markerEl.innerHTML = `
          <div style="
            width: 40px;
            height: 40px;
            background-color: ${color};
            border: 3px solid white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            cursor: pointer;
          ">
            <span style="
              color: white;
              font-weight: bold;
              font-size: 12px;
            ">${bids.length}</span>
          </div>
        `;
      } else {
        // Single marker
        markerEl.innerHTML = `
          <div style="
            width: 24px;
            height: 24px;
            background-color: ${color};
            border: 2px solid white;
            border-radius: 50%;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            cursor: pointer;
          "></div>
        `;
      }

      const mapboxgl = (await import('mapbox-gl')).default;
      
      // Configure marker with proper options per Mapbox GL JS docs
      const marker = new mapboxgl.Marker({
        element: markerEl,
        anchor: 'bottom', // Position marker bottom at coordinate
        offset: [0, 0], // No offset needed since we're using custom element
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
            maxWidth: '400px',
            closeOnClick: true, // Close popup when map is clicked
            closeOnMove: false, // Keep popup open when map moves
            closeButton: true, // Show close button
            focusAfterOpen: true, // Focus first focusable element
            className: 'mapbox-popup-custom', // Custom class for styling
          })
            .setHTML(popupContent)
        )
        .addTo(map);

      // Use Mapbox event system for better integration
      // Marker click event - show popup on click
      marker.on('click', () => {
        marker.togglePopup();
      });

      // Add click handlers - popup shows on click, details open on button click
      if (onMarkerClick) {
        if (isCluster) {
          // Handle popup button clicks using Mapbox popup events
          marker.getPopup().on('open', () => {
            const popupElement = marker.getPopup().getElement();
            if (popupElement) {
              // Set up global handlers for popup buttons
              (window as any).handleBidClick = (bidNumber: string) => {
                const bid = bids.find(b => b.bid_number === bidNumber);
                if (bid && onMarkerClick) {
                  marker.getPopup().remove();
                  onMarkerClick(bid);
                }
              };
              
              (window as any).handleViewAll = () => {
                if (bids.length > 0 && onMarkerClick) {
                  marker.getPopup().remove();
                  onMarkerClick(bids[0]);
                }
              };
            }
          });
        } else {
          // Single marker - handle popup button clicks
          marker.getPopup().on('open', () => {
            const popupElement = marker.getPopup().getElement();
            if (popupElement) {
              const button = popupElement.querySelector('button');
              if (button) {
                button.addEventListener('click', (e) => {
                  e.stopPropagation();
                  marker.getPopup().remove();
                  onMarkerClick(bids[0]);
                });
              }
              
              // Set up global handler for single bid click
              (window as any).handleSingleBidClick = (bidNumber: string) => {
                if (bids[0] && bids[0].bid_number === bidNumber && onMarkerClick) {
                  marker.getPopup().remove();
                  onMarkerClick(bids[0]);
                }
              };
            }
          });
        }
      }

      markersRef.current.push(marker);
    }

    // Fit bounds to show all markers
    if (coordinates.length > 0) {
      const mapboxgl = (await import('mapbox-gl')).default;
      const bounds = new mapboxgl.LngLatBounds();
      coordinates.forEach(([lng, lat]) => {
        bounds.extend([lng, lat]);
      });
      map.fitBounds(bounds, {
        padding: 50,
        maxZoom: 10,
      });
    }
  }, [getBidLocation, geocodeLocation, onMarkerClick]);

  // Initialize map when mounted and token is available
  useEffect(() => {
    if (mounted && hasMapboxToken && !mapRef.current) {
      initializeMap();
    }
  }, [mounted, hasMapboxToken, initializeMap]);

  // Update markers when bids change
  useEffect(() => {
    if (mapRef.current && bids.length > 0) {
      updateMarkers(bids, mapRef.current);
    }
  }, [bids, updateMarkers]);

  // Cleanup
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

  if (!mounted) {
    return (
      <div className={`relative ${className}`}>
        <div className="w-full h-full rounded-xl bg-muted/50" style={{ minHeight: '400px' }} />
      </div>
    );
  }

  if (!hasMapboxToken) {
    return (
      <div className={`relative ${className}`}>
        <div className="aspect-square bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 rounded-xl flex flex-col items-center justify-center text-muted-foreground relative overflow-hidden">
          <MapPin className="h-16 w-16 mb-3 drop-shadow-lg" />
          <p className="font-bold text-lg">Interactive Map</p>
          <p className="text-sm text-center mt-2">
            Set `NEXT_PUBLIC_MAPBOX_TOKEN`<br />
            to enable live map view
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`relative ${className}`}>
        <div className="aspect-square bg-red-50 dark:bg-red-900/20 rounded-xl flex flex-col items-center justify-center p-4">
          <p className="text-red-600 dark:text-red-400 text-sm text-center">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} style={{ minHeight: '400px', width: '100%' }}>
      <div 
        ref={mapContainerRef}
        className="w-full h-full rounded-xl overflow-hidden border border-border"
        style={{ width: '100%', height: '100%', minHeight: '400px' }}
      />
      {isLoading && (
        <div className="absolute inset-0 bg-black/20 flex items-center justify-center rounded-xl">
          <div className="bg-white dark:bg-slate-800 rounded-lg p-4 flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span className="text-sm font-medium">Loading map...</span>
          </div>
        </div>
      )}
    </div>
  );
}

