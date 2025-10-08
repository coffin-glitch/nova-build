"use client";
import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import { useTheme } from "next-themes";
import { useAccentColor } from "@/hooks/useAccentColor";

type Pin = { label: string, lng?: number, lat?: number };
type Props = {
  points: { origin?: string|null, dest?: string|null }[];
};

export default function LoadsMap({ points }: Props) {
  const ref = useRef<HTMLDivElement|null>(null);
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const { theme } = useTheme();
  const { accentColor } = useAccentColor();

  useEffect(() => {
    if (!ref.current) return;
    if (!token) {
      ref.current.innerHTML = `
        <div class="flex flex-col items-center justify-center h-full p-6 text-center">
          <div class="w-16 h-16 bg-gradient-to-br from-primary/20 to-primary/10 rounded-2xl flex items-center justify-center mb-4">
            <svg class="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
            </svg>
          </div>
          <p class="text-sm font-medium text-foreground">Map unavailable</p>
          <p class="text-xs text-muted-foreground mt-1">Missing NEXT_PUBLIC_MAPBOX_TOKEN</p>
        </div>
      `;
      return;
    }
    mapboxgl.accessToken = token as string;
    
    // Choose map style based on theme
    const mapStyle = theme === "dark" ? "mapbox://styles/mapbox/dark-v11" : "mapbox://styles/mapbox/light-v11";
    
    const map = new mapboxgl.Map({
      container: ref.current,
      style: mapStyle,
      center: [-96.9, 37.6],
      zoom: 3.5,
    } as any);

    // For now: place all pins at US center with different popups (no geocoding yet)
    points.forEach((p) => {
      const o = p.origin ?? undefined;
      const d = p.dest ?? undefined;
      if (o) new mapboxgl.Marker({ color: accentColor }).setLngLat([-96.9,37.6]).setPopup(new mapboxgl.Popup().setText(`Origin: ${o}`)).addTo(map);
      if (d) new mapboxgl.Marker({ color: "#ef4444" }).setLngLat([-96.9,37.6]).setPopup(new mapboxgl.Popup().setText(`Dest: ${d}`)).addTo(map);
    });

    return () => map.remove();
  }, [token, points, theme, accentColor]);

  return (
    <div 
      className="h-[400px] rounded-2xl border border-border/20 bg-gradient-to-br from-background/80 to-background/40 backdrop-blur-sm shadow-lg" 
      ref={ref}
      style={{
        background: `linear-gradient(135deg, ${accentColor}15, transparent 50%, ${accentColor}08)`
      }}
    />
  );
}
