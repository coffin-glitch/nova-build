"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  MapPin, 
  Clock, 
  DollarSign, 
  Truck, 
  Calendar, 
  User, 
  Building, 
  FileText,
  Weight,
  Navigation,
  Star,
  Phone,
  Mail,
  Eye
} from "lucide-react";
import { useAccentColor } from "@/hooks/useAccentColor";
import { useTheme } from "next-themes";
import { MapboxMap } from "@/components/ui/MapboxMap";
import { getButtonTextColor as getTextColor } from "@/lib/utils";

interface Load {
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
}

interface LoadDetailsDialogProps {
  load: Load;
}

const equipmentColors = {
  "Dry Van": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  "Reefer": "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  "Flatbed": "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  "Container": "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  "Tanker": "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  "Van/Reefer": "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
  "V": "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
  "R": "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
  "VR": "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

export default function LoadDetailsDialog({ load }: LoadDetailsDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
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

  const formatWeight = (weight?: number) => {
    if (!weight) return "Weight TBD";
    return `${weight.toLocaleString()} lbs`;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "TBD";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric"
      });
    } catch {
      return "TBD";
    }
  };

  const formatDateTime = (dateString?: string, window?: string) => {
    if (!dateString) return "TBD";
    const date = formatDate(dateString);
    const timeWindow = window ? ` (${window})` : "";
    return `${date}${timeWindow}`;
  };

  const formatRoute = () => {
    const origin = load.origin_city && load.origin_state ? `${load.origin_city}, ${load.origin_state}` : "Origin TBD";
    const destination = load.destination_city && load.destination_state ? `${load.destination_city}, ${load.destination_state}` : "Destination TBD";
    return `${origin} → ${destination}`;
  };

  const getRouteStops = () => {
    const stops = [];
    if (load.origin_city && load.origin_state) {
      stops.push(`${load.origin_city}, ${load.origin_state}`);
    }
    if (load.destination_city && load.destination_state) {
      stops.push(`${load.destination_city}, ${load.destination_state}`);
    }
    return stops;
  };

  const getBrokerName = () => {
    return load.customer_name || load.vendor_name || "Unknown Broker";
  };

  const getBrokerRating = () => {
    // Generate a random rating for demo purposes
    return (4.0 + Math.random()).toFixed(1);
  };

  const calculateMargin = () => {
    if (load.revenue && load.purchase) {
      return ((load.revenue - load.purchase) / load.revenue * 100).toFixed(1);
    }
    return null;
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Eye className="w-4 h-4 mr-2" />
          View Details
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Truck className="w-6 h-6" style={{ color: accentColor }} />
            Load Details - {load.rr_number}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Route</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <span className="font-semibold">{formatRoute()}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Equipment</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge
                  className={equipmentColors[load.equipment as keyof typeof equipmentColors] || "bg-gray-100 text-gray-800"}
                >
                  {load.equipment || "Equipment TBD"}
                </Badge>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" style={{ color: accentColor }}>
                  {formatPrice(load.revenue)}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Pickup & Delivery Times */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Pickup Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Date & Time</label>
                  <p className="text-lg font-semibold">
                    {formatDateTime(load.pickup_date, load.pickup_window)}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Location</label>
                  <p className="text-lg font-semibold">
                    {load.origin_city && load.origin_state 
                      ? `${load.origin_city}, ${load.origin_state}` 
                      : "Location TBD"}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Delivery Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Date & Time</label>
                  <p className="text-lg font-semibold">
                    {formatDateTime(load.delivery_date, load.delivery_window)}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Location</label>
                  <p className="text-lg font-semibold">
                    {load.destination_city && load.destination_state 
                      ? `${load.destination_city}, ${load.destination_state}` 
                      : "Location TBD"}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Load Specifications */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="w-5 h-5" />
                Load Specifications
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Weight</label>
                  <p className="text-lg font-semibold flex items-center gap-1">
                    <Weight className="w-4 h-4" />
                    {formatWeight(load.weight)}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Equipment Type</label>
                  <p className="text-lg font-semibold">{load.equipment || "TBD"}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Status</label>
                  <p className="text-lg font-semibold">{load.status_code || "Active"}</p>
                </div>
                {load.tm_number && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">TM Number</label>
                    <p className="text-lg font-semibold">{load.tm_number}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Financial Information */}
          {(load.revenue || load.purchase || load.net) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Financial Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Revenue</label>
                    <p className="text-lg font-semibold">{formatPrice(load.revenue)}</p>
                  </div>
                  {load.purchase && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Purchase</label>
                      <p className="text-lg font-semibold">{formatPrice(load.purchase)}</p>
                    </div>
                  )}
                  {load.net && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Net</label>
                      <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                        {formatPrice(load.net)}
                      </p>
                    </div>
                  )}
                  {calculateMargin() && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Margin</label>
                      <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                        {calculateMargin()}%
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Route Map */}
          {getRouteStops().length >= 2 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Navigation className="w-5 h-5" />
                  Route Map
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg overflow-hidden border border-border/40">
                  <MapboxMap 
                    stops={getRouteStops()} 
                    className="w-full h-64"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Broker Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="w-5 h-5" />
                Broker Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Broker Name</label>
                    <p className="text-lg font-semibold flex items-center gap-2">
                      <Building className="w-4 h-4" />
                      {getBrokerName()}
                    </p>
                  </div>
                  {load.customer_ref && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Reference</label>
                      <p className="text-lg font-semibold">{load.customer_ref}</p>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span className="text-sm text-muted-foreground">Rating: {getBrokerRating()}/5.0</span>
                  </div>
                </div>
                <div className="space-y-3">
                  {load.driver_name && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Driver</label>
                      <p className="text-lg font-semibold flex items-center gap-2">
                        <User className="w-4 h-4" />
                        {load.driver_name}
                      </p>
                    </div>
                  )}
                  {load.dispatcher_name && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Dispatcher</label>
                      <p className="text-lg font-semibold flex items-center gap-2">
                        <User className="w-4 h-4" />
                        {load.dispatcher_name}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Load Metadata */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Load Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <label className="font-medium text-muted-foreground">Load ID</label>
                  <p className="font-mono">{load.rr_number}</p>
                </div>
                <div>
                  <label className="font-medium text-muted-foreground">Created</label>
                  <p>{formatDate(load.created_at)}</p>
                </div>
                <div>
                  <label className="font-medium text-muted-foreground">Updated</label>
                  <p>{formatDate(load.updated_at)}</p>
                </div>
                <div>
                  <label className="font-medium text-muted-foreground">Status</label>
                  <Badge variant={load.published ? "default" : "secondary"}>
                    {load.published ? "Published" : "Draft"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
