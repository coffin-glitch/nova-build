"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Glass } from "@/components/ui/glass";
import { formatMoney, formatPickupDateTime } from "@/lib/format";
import { formatArchiveDate, toLocalTime } from "@/lib/timezone";
import { getButtonTextColor as getTextColor } from "@/lib/utils";
import {
    Archive,
    Clock,
    DollarSign,
    Eye,
    History,
    MapPin,
    Navigation,
    Truck,
    Users
} from "lucide-react";
import { useTheme } from "next-themes";
import { useState } from "react";

interface ArchiveBid {
  id: number;
  bid_number: string;
  distance_miles: number;
  pickup_timestamp: string;
  delivery_timestamp: string;
  stops: string[];
  tag: string;
  source_channel: string;
  forwarded_to: string;
  received_at: string;
  archived_at: string;
  original_id: number;
  state_tag: string;
  bids_count: number;
  lowest_bid_amount: number;
  highest_bid_amount: number;
  avg_bid_amount: number;
}

interface ArchiveBidCardProps {
  bid: ArchiveBid;
  onViewDetails?: (bid: ArchiveBid) => void;
  onViewHistory?: (bid: ArchiveBid) => void;
  accentColor?: string;
}

export function ArchiveBidCard({ 
  bid, 
  onViewDetails, 
  onViewHistory,
  accentColor = "#3b82f6" 
}: ArchiveBidCardProps) {
  const { theme } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Smart color handling for button text based on background color
  const getButtonTextColor = () => {
    return getTextColor(accentColor, theme);
  };

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
  const origin = stops[0] || 'Unknown';
  const dest = stops[stops.length - 1] || 'Unknown';

  return (
    <Glass className="p-6 space-y-4 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group cursor-pointer border-2 hover:border-primary/30">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge 
            variant="outline" 
            className="border-2"
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
          <Badge variant="destructive" className="text-xs">
            <Archive className="w-3 h-3 mr-1" />
            Archived
          </Badge>
        </div>
        <div className="text-xs text-muted-foreground">
          {new Date(bid.archived_at).toLocaleDateString()}
        </div>
      </div>

      {/* Route Info */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4" />
          <span>{origin} → {dest}</span>
          <span className="text-xs">({bid.distance_miles} mi)</span>
        </div>
        
        <div className="flex items-center gap-2 text-sm">
          <Navigation className="h-4 w-4 text-blue-500" />
          <span className="font-medium">{bid.distance_miles} miles</span>
        </div>
      </div>

      {/* Load Details */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-muted-foreground">Route:</span>
          <div className="font-medium">{origin} → {dest}</div>
        </div>
        <div>
          <span className="text-muted-foreground">Stops:</span>
          <div className="font-medium">{stops.length} stops</div>
        </div>
      </div>

      {/* Pickup Information */}
      <div className="flex items-center gap-2 text-sm">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <span className="text-muted-foreground">Pickup:</span>
        <span className="font-medium">{formatPickupDateTime(bid.pickup_timestamp)}</span>
      </div>

      {/* Delivery Information */}
      <div className="flex items-center gap-2 text-sm">
        <Truck className="h-4 w-4 text-muted-foreground" />
        <span className="text-muted-foreground">Delivery:</span>
        <span className="font-medium">{formatPickupDateTime(bid.delivery_timestamp)}</span>
      </div>

      {/* Bidding Statistics */}
      <div className="pt-3 border-t border-border/40">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Carrier Bids:</span>
            <span className="font-medium flex items-center gap-1">
              <Users className="w-3 h-3" />
              {bid.bids_count}
            </span>
          </div>
          {/* Duration removed - all bids are active for 25 minutes */}
        </div>
        
        {bid.lowest_bid_amount > 0 && (
          <div className="flex items-center justify-between text-sm mt-2">
            <span className="text-muted-foreground">Lowest Bid:</span>
            <span className="font-medium text-green-600 flex items-center gap-1">
              <DollarSign className="w-3 h-3" />
              {formatMoney(bid.lowest_bid_amount * 100)}
            </span>
          </div>
        )}
        
        {bid.highest_bid_amount > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Highest Bid:</span>
            <span className="font-medium text-red-600 flex items-center gap-1">
              <DollarSign className="w-3 h-3" />
              {formatMoney(bid.highest_bid_amount * 100)}
            </span>
          </div>
        )}
        
        {bid.avg_bid_amount > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Average Bid:</span>
            <span className="font-medium text-blue-600 flex items-center gap-1">
              <DollarSign className="w-3 h-3" />
              {formatMoney(bid.avg_bid_amount * 100)}
            </span>
          </div>
        )}
      </div>

      {/* Archive Information */}
      <div className="pt-3 border-t border-border/40">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Received:</span>
          <span className="font-medium font-mono">{toLocalTime(bid.received_at, { hour12: true, showSeconds: true })}</span>
        </div>
        {bid.archived_at && (
          <div className="flex items-center justify-between text-sm mt-2">
            <span className="text-muted-foreground">Archived:</span>
            <span className="font-medium">{formatArchiveDate(bid.archived_at)}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="pt-4 border-t border-border/40">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Auction Closed
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onViewDetails?.(bid)}
            >
              <Eye className="w-4 h-4 mr-1" />
              View Details
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onViewHistory?.(bid)}
            >
              <History className="w-4 h-4 mr-1" />
              Bid History
            </Button>
          </div>
        </div>
      </div>
    </Glass>
  );
}

