"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, Navigation, Truck } from "lucide-react";

interface MapboxMapProps {
  stops: string[];
  className?: string;
}

export function MapboxMap({ stops, className = "" }: MapboxMapProps) {
  const [hasMapboxToken, setHasMapboxToken] = useState(false);

  useEffect(() => {
    // Check if Mapbox token is available
    setHasMapboxToken(!!process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN);
  }, []);

  if (!hasMapboxToken) {
    // Placeholder component when no Mapbox token is available
    return (
      <div className={`relative ${className}`}>
        <div 
          className="w-full h-full rounded-lg overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-800 dark:to-slate-900 border border-border/40"
          style={{ minHeight: '300px' }}
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
          </div>
        </div>
      </div>
    );
  }

  // This will be the actual Mapbox implementation when token is available
  return (
    <div className={`relative ${className}`}>
      <div 
        className="w-full h-full rounded-lg overflow-hidden bg-muted/50 flex items-center justify-center"
        style={{ minHeight: '300px' }}
      >
        <div className="text-center space-y-2">
          <MapPin className="w-8 h-8 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">Mapbox integration ready</p>
          <p className="text-xs text-muted-foreground">Add your token to enable</p>
        </div>
      </div>
    </div>
  );
}
