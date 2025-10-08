"use client";

import { MapPin, Clock, DollarSign, Star, User, Calendar, Eye, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useAccentColor } from "@/hooks/useAccentColor";
import { useTheme } from "next-themes";
import OfferDialog from "./OfferDialog";
import LoadDetailsDialog from "./LoadDetailsDialog";

// Real EAX data structure
interface LoadCardProps {
  rr_number: string;
  tm_number?: string;
  status_code?: string;
  pickup_date?: string;
  pickup_time?: string;
  pickup_window?: string;
  delivery_date?: string;
  delivery_time?: string;
  delivery_window?: string;
  equipment?: string;
  weight?: number;
  miles?: number;
  stops?: number;
  revenue?: number;
  purchase?: number;
  net?: number;
  margin?: number;
  customer_name?: string;
  customer_ref?: string;
  driver_name?: string;
  origin_city?: string;
  origin_state?: string;
  destination_city?: string;
  destination_state?: string;
  vendor_name?: string;
  dispatcher_name?: string;
  published: boolean;
  archived?: boolean;
  created_at: string;
  updated_at: string;
  onOfferSubmitted?: () => void;
  className?: string;
}

const equipmentColors = {
  "Dry Van": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  "Reefer": "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  "Flatbed": "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  "Container": "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  "Tanker": "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  "Van/Reefer": "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
  "V": "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

export default function LoadCard({
  rr_number,
  tm_number,
  status_code,
  pickup_date,
  pickup_time,
  pickup_window,
  delivery_date,
  delivery_time,
  delivery_window,
  equipment,
  weight,
  miles,
  stops,
  revenue,
  purchase,
  net,
  margin,
  customer_name,
  customer_ref,
  driver_name,
  origin_city,
  origin_state,
  destination_city,
  destination_state,
  vendor_name,
  dispatcher_name,
  published,
  archived,
  created_at,
  updated_at,
  onOfferSubmitted,
  className,
}: LoadCardProps) {
  const { accentColor } = useAccentColor();
  const { theme } = useTheme();
  
  // Smart color handling for white accent color
  const getButtonTextColor = () => {
    if (accentColor === 'hsl(0, 0%, 100%)') {
      return '#000000';
    }
    return '#ffffff';
  };

  const formatPrice = (amount?: number) => {
    if (!amount) return "Rate TBD";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatMiles = (miles?: number) => {
    if (!miles) return "Miles TBD";
    return `${miles.toLocaleString()} mi`;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "TBD";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
      });
    } catch {
      return "TBD";
    }
  };

  const formatRoute = () => {
    const origin = origin_city && origin_state ? `${origin_city}, ${origin_state}` : "Origin TBD";
    const destination = destination_city && destination_state ? `${destination_city}, ${destination_state}` : "Destination TBD";
    return `${origin} → ${destination}`;
  };

  const formatPickupTime = () => {
    if (!pickup_date) return "TBD";
    const date = formatDate(pickup_date);
    const window = pickup_window ? ` (${pickup_window})` : "";
    return `${date}${window}`;
  };

  const formatDeliveryTime = () => {
    if (!delivery_date) return "TBD";
    const date = formatDate(delivery_date);
    const window = delivery_window ? ` (${delivery_window})` : "";
    return `${date}${window}`;
  };

  const getBrokerName = () => {
    return customer_name || vendor_name || "Unknown Broker";
  };

  const getBrokerRating = () => {
    // Generate a random rating for demo purposes
    return (4.0 + Math.random()).toFixed(1);
  };

  return (
    <div
      className={cn(
        "group bg-card border border-border rounded-xl p-6 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 cursor-pointer",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Badge
              variant="secondary"
              className={equipmentColors[equipment as keyof typeof equipmentColors] || "bg-gray-100 text-gray-800"}
            >
              {equipment || "Equipment TBD"}
            </Badge>
            {status_code && (
              <Badge variant="outline" className="text-xs">
                {status_code}
              </Badge>
            )}
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-1">{formatRoute()}</h3>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <span>{formatPickupTime()}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>{formatDeliveryTime()}</span>
            </div>
          </div>
          {tm_number && (
            <div className="text-xs text-muted-foreground mt-1">
              TM: {tm_number}
            </div>
          )}
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-foreground">{formatPrice(revenue)}</div>
          <div className="text-sm text-muted-foreground">{formatMiles(miles)}</div>
          {net && (
            <div className="text-xs text-green-600 dark:text-green-400">
              Net: {formatPrice(net)}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-border">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback>
              <User className="h-4 w-4" />
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="text-sm font-medium text-foreground">{getBrokerName()}</div>
            <div className="flex items-center gap-1">
              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
              <span className="text-xs text-muted-foreground">{getBrokerRating()}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <LoadDetailsDialog
            load={{
              rr_number,
              tm_number,
              status_code,
              pickup_date,
              pickup_window,
              delivery_date,
              delivery_window,
              equipment,
              weight,
              revenue,
              purchase,
              net,
              margin,
              customer_name,
              customer_ref,
              driver_name,
              origin_city,
              origin_state,
              destination_city,
              destination_state,
              vendor_name,
              dispatcher_name,
              published,
              created_at,
              updated_at,
            }}
          />
          <OfferDialog
            loadRrNumber={rr_number}
            loadDetails={{
              origin_city,
              origin_state,
              destination_city,
              destination_state,
              revenue,
              equipment,
            }}
            onOfferSubmitted={onOfferSubmitted}
          />
        </div>
      </div>
    </div>
  );
}

