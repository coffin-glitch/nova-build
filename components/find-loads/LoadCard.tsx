"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAccentColor } from "@/hooks/useAccentColor";
import { cn, getButtonTextColor as getTextColor } from "@/lib/utils";
import { Calendar, Clock, Star, User } from "lucide-react";
import { useTheme } from "next-themes";
import LoadDetailsDialog from "./LoadDetailsDialog";
import OfferDialog from "./OfferDialog";

// Real EAX data structure - Carrier visible fields only
interface LoadCardProps {
  rr_number: string;
  tm_number?: string;
  status_code?: string;
  pickup_date?: string;
  pickup_time?: string;
  delivery_date?: string;
  delivery_time?: string;
  equipment?: string;
  weight?: number;
  miles?: number;
  stops?: number;
  target_buy?: number; // Carrier can see target buy
  customer_name?: string;
  origin_city?: string;
  origin_state?: string;
  destination_city?: string;
  destination_state?: string;
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
  delivery_date,
  delivery_time,
  equipment,
  weight,
  miles,
  stops,
  target_buy,
  customer_name,
  origin_city,
  origin_state,
  destination_city,
  destination_state,
  published,
  archived,
  created_at,
  updated_at,
  onOfferSubmitted,
  className,
}: LoadCardProps) {
  const { accentColor } = useAccentColor();
  const { theme } = useTheme();
  
  // Smart color handling for button text based on background color
  const getButtonTextColor = () => {
    return getTextColor(accentColor, theme);
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
    const time = pickup_time ? ` at ${pickup_time}` : "";
    return `${date}${time}`;
  };

  const formatDeliveryTime = () => {
    if (!delivery_date) return "TBD";
    const date = formatDate(delivery_date);
    const time = delivery_time ? ` at ${delivery_time}` : "";
    return `${date}${time}`;
  };

  const getBrokerName = () => {
    return customer_name || "Unknown Broker";
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
          <div className="text-2xl font-bold text-foreground">{formatPrice(target_buy)}</div>
          <div className="text-sm text-muted-foreground">{formatMiles(miles)}</div>
          {weight && (
            <div className="text-xs text-muted-foreground">
              Weight: {weight.toLocaleString()} lbs
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
              pickup_time,
              delivery_date,
              delivery_time,
              equipment,
              weight,
              miles,
              stops,
              customer_name,
              origin_city,
              origin_state,
              destination_city,
              destination_state,
              published,
              created_at,
              updated_at,
            } as any}
          />
          <OfferDialog
            loadRrNumber={rr_number}
            loadDetails={{
              origin_city,
              origin_state,
              destination_city,
              destination_state,
              equipment,
            }}
            onOfferSubmitted={onOfferSubmitted}
          />
        </div>
      </div>
    </div>
  );
}

