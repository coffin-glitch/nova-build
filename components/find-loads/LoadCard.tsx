"use client";

import { MapPin, Clock, DollarSign, Star, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface LoadCardProps {
  id: string;
  route: string;
  pickup: string;
  delivery: string;
  equipment: string;
  price: number;
  miles: number;
  broker: {
    name: string;
    avatar?: string;
    rating: number;
  };
  onBookLoad: (id: string) => void;
  className?: string;
}

const equipmentColors = {
  "Dry Van": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  "Reefer": "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  "Flatbed": "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  "Container": "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  "Tanker": "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export default function LoadCard({
  id,
  route,
  pickup,
  delivery,
  equipment,
  price,
  miles,
  broker,
  onBookLoad,
  className,
}: LoadCardProps) {
  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatMiles = (miles: number) => {
    return `${miles.toLocaleString()} mi`;
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
              {equipment}
            </Badge>
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-1">{route}</h3>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              <span>{pickup}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>{delivery}</span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-foreground">{formatPrice(price)}</div>
          <div className="text-sm text-muted-foreground">{formatMiles(miles)}</div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-border">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={broker.avatar} alt={broker.name} />
            <AvatarFallback>
              <User className="h-4 w-4" />
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="text-sm font-medium text-foreground">{broker.name}</div>
            <div className="flex items-center gap-1">
              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
              <span className="text-xs text-muted-foreground">{broker.rating}</span>
            </div>
          </div>
        </div>
        <Button
          onClick={() => onBookLoad(id)}
          size="sm"
          className="group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
        >
          Book Load
        </Button>
      </div>
    </div>
  );
}
