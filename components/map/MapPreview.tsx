"use client";
import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";

type Props = {
  origin?: string | null;
  dest?: string | null;
};

export default function MapPreview({ origin, dest }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  useEffect(() => {
    if (!ref.current) return;
    if (!token) {
      ref.current.innerHTML = `
        <div class="flex flex-col items-center justify-center h-full p-6 text-center">
          <div class="w-12 h-12 bg-brand-500/10 rounded-xl flex items-center justify-center mb-3">
            <svg class="w-6 h-6 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
            </svg>
          </div>
          <p class="text-sm text-muted-foreground">Map preview unavailable</p>
          <p class="text-xs text-muted-foreground mt-1">Missing NEXT_PUBLIC_MAPBOX_TOKEN</p>
        </div>
      `;
      return;
    }
    mapboxgl.accessToken = token as string;
    // Use light v11 style (stable and well-supported)
    // TODO: Upgrade to Mapbox Standard style when GL JS version fully supports it
    const map = new mapboxgl.Map({
      container: ref.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: [-96.9, 37.6],
      zoom: 3.4,
    } as any);

    // Simple markers for now. Geocoding could be added later.
    function markerFor(txt?: string | null, color="#2563eb") {
      if (!txt) return;
      // Fake coords cache or naive fallback: center US
      new mapboxgl.Marker({ color }).setLngLat([-96.9, 37.6]).setPopup(new mapboxgl.Popup().setText(txt)).addTo(map);
    }
    markerFor(origin, "#10b981");
    markerFor(dest, "#ef4444");

    return () => map.remove();
  }, [token, origin, dest]);

  return <div className="h-64 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm shadow-lg" ref={ref} />;
}
