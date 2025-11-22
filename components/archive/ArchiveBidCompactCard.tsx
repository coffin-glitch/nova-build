"use client";

import { Badge } from "@/components/ui/badge";
import { Archive, Calendar, MapPin, Navigation } from "lucide-react";
import { useTheme } from "next-themes";
import { formatStops, formatAddressForCard } from "@/lib/format";

interface ArchiveBid {
  id: number;
  bid_number: string;
  distance_miles: number;
  pickup_timestamp: string;
  delivery_timestamp: string;
  stops: string[];
  tag: string;
  state_tag: string;
  archived_at: string;
}

interface ArchiveBidCompactCardProps {
  bid: ArchiveBid;
  onClick?: () => void;
  accentColor?: string;
}

export function ArchiveBidCompactCard({ 
  bid, 
  onClick,
  accentColor = "#3b82f6" 
}: ArchiveBidCompactCardProps) {
  const { theme } = useTheme();
  
  const parseStops = (stops: string | string[] | null): string[] => {
    if (!stops) return [];
    if (Array.isArray(stops)) return stops;
    if (typeof stops === 'string') {
      try {
        return JSON.parse(stops);
      } catch {
        return [stops];
      }
    }
    return [];
  };

  const stops = parseStops(bid.stops);
  // Use formatStops to get properly formatted route display (City, State ZIP → City, State ZIP)
  const formattedRoute = formatStops(stops);
  const pickupDate = bid.pickup_timestamp 
    ? new Date(bid.pickup_timestamp).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : 'N/A';

  return (
    <div
      onClick={onClick}
      className="group relative p-4 rounded-lg border border-border/40 bg-card/50 backdrop-blur-sm hover:bg-card/80 hover:border-border/60 hover:shadow-md transition-all duration-200 cursor-pointer hover:-translate-y-0.5"
      style={{
        borderColor: `${accentColor}20`,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Badge 
            variant="outline" 
            className="text-xs font-mono border-2"
            style={{
              backgroundColor: `${accentColor}15`,
              color: accentColor === 'hsl(0, 0%, 100%)' && theme !== 'dark' ? '#000000' : accentColor,
              borderColor: `${accentColor}40`
            }}
          >
            #{bid.bid_number}
          </Badge>
          <Badge variant="secondary" className="text-xs">
            {bid.state_tag || 'UNKNOWN'}
          </Badge>
        </div>
        <Archive className="w-3 h-3 text-muted-foreground" />
      </div>

      {/* Route */}
      <div className="space-y-2 mb-3">
        <div className="flex items-center gap-2 text-sm">
          <MapPin className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
          <span className="truncate text-foreground font-medium">
            {formattedRoute}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Navigation className="w-3 h-3" />
          <span>{bid.distance_miles || 0} mi</span>
        </div>
      </div>

      {/* Date */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Calendar className="w-3 h-3" />
        <span>{pickupDate}</span>
      </div>

      {/* Hover effect overlay */}
      <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-primary/0 to-primary/0 group-hover:from-primary/5 group-hover:to-primary/10 transition-all duration-200 pointer-events-none" />
    </div>
  );
}

