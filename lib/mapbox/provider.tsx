"use client";

import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { MapContext } from "@/context/map-context";
import { useTheme } from "next-themes";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || 
                      process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

type MapProviderProps = {
  mapContainerRef: React.RefObject<HTMLDivElement | null>;
  initialViewState?: {
    longitude: number;
    latitude: number;
    zoom: number;
  };
  children?: React.ReactNode;
  style?: string;
};

export default function MapProvider({
  mapContainerRef,
  initialViewState = {
    longitude: -96.9,
    latitude: 37.6,
    zoom: 4,
  },
  children,
  style,
}: MapProviderProps) {
  const map = useRef<mapboxgl.Map | null>(null);
  const [loaded, setLoaded] = useState(false);
  const { theme } = useTheme();

  useEffect(() => {
    if (!mapContainerRef.current || map.current) return;
    if (!mapboxgl.accessToken) {
      console.warn("Mapbox token not found");
      return;
    }

    // Use provided style or theme-based default
    const mapStyle = style || (theme === "dark" 
      ? "mapbox://styles/mapbox/dark-v11" 
      : "mapbox://styles/mapbox/light-v11");

    // Wait for container to have dimensions
    const container = mapContainerRef.current;
    if (container.offsetWidth === 0 || container.offsetHeight === 0) {
      // Retry after a short delay
      const timer = setTimeout(() => {
        if (container.offsetWidth > 0 && container.offsetHeight > 0) {
          initializeMap();
        }
      }, 100);
      return () => clearTimeout(timer);
    }

    function initializeMap() {
      if (!mapContainerRef.current || map.current) return;
      if (!mapboxgl.accessToken) {
        console.warn("Mapbox token not found");
        return;
      }

      map.current = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: mapStyle,
        center: [initialViewState.longitude, initialViewState.latitude],
        zoom: initialViewState.zoom,
        attributionControl: false,
        logoPosition: "bottom-right",
        minZoom: 3,
        maxZoom: 15,
        pitch: 0,
        bearing: 0,
        antialias: false,
        preserveDrawingBuffer: false,
      });

      map.current.on("load", () => {
        setLoaded(true);
        // Resize to ensure proper display (important for dialogs)
        setTimeout(() => {
          map.current?.resize();
        }, 100);
      });

      // Handle style loading errors
      map.current.on('error', (e: any) => {
        const errorMessage = e?.error?.message || e?.error || e?.message || '';
        if (errorMessage && typeof errorMessage === 'string' && errorMessage.trim() !== '') {
          console.error('Mapbox error:', errorMessage);
        }
      });
    }

    // Check if container has dimensions, if not wait a bit
    if (container.offsetWidth > 0 && container.offsetHeight > 0) {
      initializeMap();
    } else {
      const timer = setTimeout(() => {
        if (container.offsetWidth > 0 && container.offsetHeight > 0) {
          initializeMap();
        }
      }, 100);
      return () => clearTimeout(timer);
    }

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [mapContainerRef, initialViewState, style, theme]);

  // Update style when theme changes
  useEffect(() => {
    if (!map.current || !loaded) return;
    
    const newStyle = style || (theme === "dark" 
      ? "mapbox://styles/mapbox/dark-v11" 
      : "mapbox://styles/mapbox/light-v11");
    
    map.current.setStyle(newStyle);
  }, [theme, style, loaded]);

  // Resize observer for container changes
  useEffect(() => {
    if (!map.current || !mapContainerRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      if (map.current) {
        setTimeout(() => {
          map.current?.resize();
        }, 100);
      }
    });

    resizeObserver.observe(mapContainerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [map.current, mapContainerRef]);

  return (
    <MapContext.Provider value={{ map: map.current }}>
      {children}
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-[1000]">
          <div className="text-lg font-medium">Loading map...</div>
        </div>
      )}
    </MapContext.Provider>
  );
}

