"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatStopCount } from "@/lib/format";
import { splitCityState } from "@/lib/geo";
import { Info, Loader2, MapPin } from "lucide-react";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useRef, useState } from "react";

interface Bid {
  bid_number: string;
  stops?: string | string[] | null;
  origin_city?: string;
  origin_state?: string;
  destination_city?: string;
  destination_state?: string;
  is_expired?: boolean;
  received_at?: string;
  expires_at_25?: string;
  time_left_seconds?: number;
  distance_miles?: number;
  bids_count?: number;
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
  const popupUpdateIntervalsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const { theme } = useTheme();
  const [isLoading, setIsLoading] = useState(false);
  const [hasMapboxToken, setHasMapboxToken] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attributionOpen, setAttributionOpen] = useState(false);

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

  // Geocode location - use API for accurate positioning with fallback
  const geocodeLocation = useCallback(async (location: string): Promise<[number, number] | null> => {
    if (!location || !location.trim()) return null;
    
    try {
      const { geocodeLocation: geocode } = await import('@/lib/mapbox-geocode');
      // Try API geocoding first for accurate marker positioning
      const result = await geocode(location.trim(), true); // true = use API
      
      // Handle null result (no results found from API)
      if (!result) {
        console.warn(`Geocoding API returned null for ${location}, trying approximations`);
        // Try with approximations as fallback
        const fallbackResult = await geocode(location.trim(), false); // false = use approximations
        if (!fallbackResult || (fallbackResult.lng === -96.9 && fallbackResult.lat === 37.6)) {
          console.warn(`Geocoding fallback also failed for ${location}`);
          return null;
        }
        return [fallbackResult.lng, fallbackResult.lat];
      }
      
      // Validate result - don't use default coordinates
      if (result.lng === -96.9 && result.lat === 37.6) {
        console.warn(`Geocoding returned default coordinates for ${location}, trying fallback`);
        // Try with approximations as fallback
        const fallbackResult = await geocode(location.trim(), false); // false = use approximations
        if (!fallbackResult || (fallbackResult.lng === -96.9 && fallbackResult.lat === 37.6)) {
          console.warn(`Geocoding fallback also failed for ${location}`);
          return null;
        }
        return [fallbackResult.lng, fallbackResult.lat];
      }
      
      return [result.lng, result.lat];
    } catch (error) {
      // If API fails, try approximations as fallback
      try {
        console.warn(`Geocoding API error for ${location}, trying approximations:`, error);
        const { geocodeLocation: geocode } = await import('@/lib/mapbox-geocode');
        const fallbackResult = await geocode(location.trim(), false); // false = use approximations
        
        // Handle null or default coordinates
        if (!fallbackResult || (fallbackResult.lng === -96.9 && fallbackResult.lat === 37.6)) {
          console.warn(`Geocoding fallback also failed for ${location}`);
          return null;
        }
        
        return [fallbackResult.lng, fallbackResult.lat];
      } catch (fallbackError) {
        console.warn(`Geocoding completely failed for ${location}:`, fallbackError);
        return null;
      }
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
    // Clear existing popup update intervals
    popupUpdateIntervalsRef.current.forEach(interval => clearInterval(interval));
    popupUpdateIntervalsRef.current.clear();
    
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
      
      // Calculate color based on countdown time remaining
      // For clusters, use the most urgent active bid's time
      // Color scheme: Green (>5min) > Yellow (1-5min) > Red (<1min or expired)
      const getMarkerColor = (bidList: Bid[]): string => {
        const activeBids = bidList.filter(b => !b.is_expired);
        if (activeBids.length === 0) return '#ef4444'; // Red for expired
        
        // Find the most urgent active bid
        let minTimeLeft = Infinity;
        for (const bid of activeBids) {
          const timeLeft = bid.time_left_seconds || (() => {
            // Calculate from expires_at_25 or received_at
            if (bid.expires_at_25) {
              return Math.max(0, Math.floor((new Date(bid.expires_at_25).getTime() - Date.now()) / 1000));
            }
            if (bid.received_at) {
              const expiresAt = new Date(bid.received_at).getTime() + (25 * 60 * 1000);
              return Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
            }
            return Infinity;
          })();
          minTimeLeft = Math.min(minTimeLeft, timeLeft);
        }
        
        // Color based on time remaining
        if (minTimeLeft <= 60) return '#ef4444'; // Red: <1 minute
        if (minTimeLeft <= 300) return '#f59e0b'; // Yellow/Orange: 1-5 minutes
        return '#10b981'; // Green: >5 minutes
      };
      
      const color = getMarkerColor(bids);

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
        
        // Helper to get countdown time
        const getCountdown = (bid: Bid): string => {
          if (bid.is_expired) return 'Expired';
          const timeLeft = bid.time_left_seconds || (() => {
            if (bid.expires_at_25) {
              return Math.max(0, Math.floor((new Date(bid.expires_at_25).getTime() - Date.now()) / 1000));
            }
            if (bid.received_at) {
              const expiresAt = new Date(bid.received_at).getTime() + (25 * 60 * 1000);
              return Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
            }
            return 0;
          })();
          const minutes = Math.floor(timeLeft / 60);
          const seconds = timeLeft % 60;
          if (minutes > 0) {
            return `${minutes}m ${seconds}s`;
          }
          return `${seconds}s`;
        };
        
        // Helper to get countdown color
        const getCountdownColor = (bid: Bid): string => {
          if (bid.is_expired) return 'text-red-600';
          const timeLeft = bid.time_left_seconds || (() => {
            if (bid.expires_at_25) {
              return Math.max(0, Math.floor((new Date(bid.expires_at_25).getTime() - Date.now()) / 1000));
            }
            if (bid.received_at) {
              const expiresAt = new Date(bid.received_at).getTime() + (25 * 60 * 1000);
              return Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
            }
            return 0;
          })();
          if (timeLeft <= 60) return 'text-red-600';
          if (timeLeft <= 300) return 'text-yellow-600';
          return 'text-green-600';
        };
        
        popupContent = `
          <div class="min-w-[360px] max-w-[420px] bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <!-- Header with gradient -->
            <div class="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 p-4 text-white">
              <div class="flex items-center justify-between mb-2">
                <h3 class="font-bold text-lg">${bids.length} Bid${bids.length > 1 ? 's' : ''}</h3>
                <div class="flex items-center gap-2">
                  <span class="text-xs px-2.5 py-1 rounded-full backdrop-blur-sm bg-green-500/90 text-white font-semibold">
                    ${activeCount} Active
                  </span>
                  ${expiredCount > 0 ? `
                    <span class="text-xs px-2.5 py-1 rounded-full backdrop-blur-sm bg-red-500/90 text-white font-semibold">
                      ${expiredCount} Expired
                    </span>
                  ` : ''}
                </div>
              </div>
              <p class="text-sm text-white/90 flex items-center gap-1.5">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                </svg>
                ${clusterLocation || 'Location'}
              </p>
            </div>
            
            <!-- Bids List -->
            <div class="max-h-80 overflow-y-auto p-3 space-y-2">
              ${bids.map((bid, idx) => `
                <div class="group bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 border border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-200" data-bid-number="${bid.bid_number}">
                  <div class="flex items-start justify-between gap-3">
                    <div class="flex-1 min-w-0">
                      <!-- Bid Number & Status -->
                      <div class="flex items-center gap-2 mb-1.5">
                        <span class="font-bold text-sm text-gray-900 dark:text-white">#${bid.bid_number}</span>
                        <span class="text-xs px-2 py-0.5 rounded-full ${
                          bid.is_expired 
                            ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' 
                            : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                        } font-semibold">
                          ${bid.is_expired ? 'Expired' : 'Active'}
                        </span>
                      </div>
                      
                      <!-- Route -->
                      <p class="text-xs text-gray-700 dark:text-gray-300 mb-2 line-clamp-1 font-medium">${getRouteSummary(bid)}</p>
                      
                      <!-- Stats Row -->
                      <div class="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400">
                        <span class="flex items-center gap-1">
                          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path>
                          </svg>
                          ${getDistance(bid)}
                        </span>
                        ${bid.bids_count ? `
                          <span class="flex items-center gap-1">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                            </svg>
                            ${bid.bids_count} bid${bid.bids_count > 1 ? 's' : ''}
                          </span>
                        ` : ''}
                      </div>
                      
                      <!-- Countdown -->
                      ${!bid.is_expired ? `
                        <div class="mt-2 flex items-center gap-1.5">
                          <svg class="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                          </svg>
                          <span class="text-xs font-semibold countdown-text ${getCountdownColor(bid)}" data-bid-number="${bid.bid_number}" data-expires-at="${bid.expires_at_25 || (bid.received_at ? new Date(new Date(bid.received_at).getTime() + (25 * 60 * 1000)).toISOString() : '')}">${getCountdown(bid)}</span>
                        </div>
                      ` : ''}
                    </div>
                    
                    <!-- View Button -->
                    ${onMarkerClick ? `
                      <button 
                        class="flex-shrink-0 p-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white transition-all duration-200 shadow-sm hover:shadow-md group-hover:scale-105"
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
        
        // Get countdown for single bid (live calculation)
        const getCountdown = (bid: Bid): string => {
          if (bid.is_expired) return 'Expired';
          const timeLeft = (() => {
            if (bid.expires_at_25) {
              return Math.max(0, Math.floor((new Date(bid.expires_at_25).getTime() - Date.now()) / 1000));
            }
            if (bid.received_at) {
              const expiresAt = new Date(bid.received_at).getTime() + (25 * 60 * 1000);
              return Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
            }
            return 0;
          })();
          const minutes = Math.floor(timeLeft / 60);
          const seconds = timeLeft % 60;
          if (minutes > 0) {
            return `${minutes}m ${seconds}s`;
          }
          return `${seconds}s`;
        };
        
        // Get countdown color (live calculation)
        const getCountdownColor = (bid: Bid): string => {
          if (bid.is_expired) return 'text-red-600';
          const timeLeft = (() => {
            if (bid.expires_at_25) {
              return Math.max(0, Math.floor((new Date(bid.expires_at_25).getTime() - Date.now()) / 1000));
            }
            if (bid.received_at) {
              const expiresAt = new Date(bid.received_at).getTime() + (25 * 60 * 1000);
              return Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
            }
            return 0;
          })();
          if (timeLeft <= 60) return 'text-red-600';
          if (timeLeft <= 300) return 'text-yellow-600';
          return 'text-green-600';
        };
        
        const countdownTime = getCountdown(bid);
        const countdownColor = getCountdownColor(bid);
        const countdownBgColor = countdownColor === 'text-red-600' ? 'bg-red-50' : countdownColor === 'text-yellow-600' ? 'bg-yellow-50' : 'bg-green-50';
        
        popupContent = `
          <div class="min-w-[320px] max-w-[380px] bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <!-- Header with gradient -->
            <div class="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 p-4 text-white">
              <div class="flex items-center justify-between mb-2">
                <h3 class="font-bold text-lg">Bid #${bid.bid_number}</h3>
                <span class="text-xs px-2.5 py-1 rounded-full backdrop-blur-sm ${
                  bid.is_expired 
                    ? 'bg-red-500/90 text-white' 
                    : 'bg-green-500/90 text-white'
                } font-semibold">
                  ${bid.is_expired ? 'Expired' : 'Active'}
                </span>
              </div>
              ${!bid.is_expired ? `
                <div class="flex items-center gap-2 mt-2">
                  <svg class="w-4 h-4 text-white/90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  <span class="text-sm font-semibold countdown-text text-white" data-bid-number="${bid.bid_number}" data-expires-at="${bid.expires_at_25 || (bid.received_at ? new Date(new Date(bid.received_at).getTime() + (25 * 60 * 1000)).toISOString() : '')}">${countdownTime}</span>
                </div>
              ` : ''}
            </div>
            
            <!-- Content -->
            <div class="p-4 space-y-3">
              <!-- Route Info -->
              <div class="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                <svg class="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                </svg>
                <div class="flex-1 min-w-0">
                  <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Route</p>
                  <p class="font-semibold text-sm text-gray-900 dark:text-white line-clamp-2">${routeSummary}</p>
                </div>
              </div>
              
              <!-- Stats Grid -->
              <div class="grid grid-cols-2 gap-2">
                <div class="p-2.5 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                  <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Distance</p>
                  <p class="font-bold text-sm text-gray-900 dark:text-white">${distance}</p>
                </div>
                ${bid.bids_count ? `
                  <div class="p-2.5 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                    <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Bids</p>
                    <p class="font-bold text-sm text-gray-900 dark:text-white">${bid.bids_count}</p>
                  </div>
                ` : `
                  ${stops.length > 0 ? `
                    <div class="p-2.5 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                      <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Stops</p>
                      <p class="font-bold text-sm text-gray-900 dark:text-white">${formatStopCount(stops)}</p>
                    </div>
                  ` : '<div></div>'}
                `}
              </div>
              
              ${stops.length > 0 && bid.bids_count ? `
                <div class="p-2.5 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                  <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Stops</p>
                  <p class="font-bold text-sm text-gray-900 dark:text-white">${formatStopCount(stops)}</p>
                </div>
              ` : ''}
              
              <!-- Action Button -->
              ${onMarkerClick ? `
                <button 
                  class="w-full mt-3 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2"
                  onclick="window.handleSingleBidClick && window.handleSingleBidClick('${bid.bid_number}'); event.stopPropagation();"
                >
                  <span>View Full Details</span>
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                  </svg>
                </button>
              ` : ''}
            </div>
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

      // Set up live countdown updates for popup
      const updatePopupCountdown = () => {
        const popup = marker.getPopup();
        if (!popup.isOpen()) return;
        
        const popupElement = popup.getElement();
        if (!popupElement) return;
        
        // Find all countdown elements in the popup
        const countdownElements = popupElement.querySelectorAll('.countdown-text');
        countdownElements.forEach((el: Element) => {
          const expiresAtStr = el.getAttribute('data-expires-at');
          if (!expiresAtStr) return;
          
          const expiresAt = new Date(expiresAtStr).getTime();
          const now = Date.now();
          const timeLeft = Math.max(0, Math.floor((expiresAt - now) / 1000));
          
          const minutes = Math.floor(timeLeft / 60);
          const seconds = timeLeft % 60;
          const countdownText = timeLeft === 0 ? 'Expired' : (minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`);
          
          // Update text content - the countdown-text span contains the text directly
          // The SVG icon is a sibling, not a child, so we just update the span's text
          const htmlEl = el as HTMLElement;
          
          // Check if this span is inside a container with an SVG (for styling context)
          const parent = htmlEl.parentElement;
          const hasSiblingIcon = parent?.querySelector('svg') !== null;
          
          // Update the text content directly
          // For single bid popup (white text on gradient), keep it simple
          // For cluster popup (colored text), preserve any existing structure
          if (htmlEl.classList.contains('text-white')) {
            // Single bid popup - just update text
            htmlEl.textContent = countdownText;
          } else {
            // Cluster popup - might have SVG sibling, but we update the span directly
            htmlEl.textContent = countdownText;
          }
          
          // Update color class - remove all color classes first
          htmlEl.className = htmlEl.className.replace(/text-(red|yellow|green)-600/g, '');
          let newColorClass = 'text-green-600';
          if (timeLeft === 0) {
            newColorClass = 'text-red-600';
          } else if (timeLeft <= 60) {
            newColorClass = 'text-red-600';
          } else if (timeLeft <= 300) {
            newColorClass = 'text-yellow-600';
          }
          htmlEl.classList.add(newColorClass);
        });
      };
      
      // Set up interval to update countdown every second when popup is open
      const popupId = `popup-${bids.map(b => b.bid_number).join('-')}-${Date.now()}`;
      marker.getPopup().on('open', () => {
        const intervalId = setInterval(updatePopupCountdown, 1000);
        popupUpdateIntervalsRef.current.set(popupId, intervalId);
        updatePopupCountdown(); // Update immediately
      });
      
      marker.getPopup().on('close', () => {
        // Clear interval when popup closes
        const intervalId = popupUpdateIntervalsRef.current.get(popupId);
        if (intervalId) {
          clearInterval(intervalId);
          popupUpdateIntervalsRef.current.delete(popupId);
        }
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
      // Clear all popup update intervals
      popupUpdateIntervalsRef.current.forEach(interval => clearInterval(interval));
      popupUpdateIntervalsRef.current.clear();
      
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
      
      {/* Custom Attribution Button - Bottom Right */}
      {mapRef.current && !isLoading && (
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

