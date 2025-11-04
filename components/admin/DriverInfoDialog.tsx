"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Clock, MapPin, Truck, User } from "lucide-react";

interface DriverInfoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offer: {
    id: number | string;
    load_rr_number?: string;
    bid_number?: string;
    driver_name?: string;
    driver_phone?: string;
    driver_email?: string;
    driver_license_number?: string;
    driver_license_state?: string;
    truck_number?: string;
    trailer_number?: string;
    driver_info_submitted_at?: string;
    origin_city?: string;
    origin_state?: string;
    destination_city?: string;
    destination_state?: string;
    pickup_date?: string;
    delivery_date?: string;
    pickup_timestamp?: string;
    delivery_timestamp?: string;
    equipment?: string;
    equipment_type?: string;
    carrier_email?: string;
    carrier_name?: string;
    carrier_phone?: string;
    stops?: any;
    miles?: number;
  } | null;
  isBid?: boolean;
}

export function DriverInfoDialog({ open, onOpenChange, offer, isBid = false }: DriverInfoDialogProps) {
  if (!offer) return null;

  // Debug logging to see what data we're receiving
  console.log('DriverInfoDialog - offer data:', offer);
  console.log('DriverInfoDialog - isBid:', isBid);
  console.log('DriverInfoDialog - stops:', offer.stops);

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Check if driver information is complete
  const isDriverInfoComplete = () => {
    const requiredFields = [
      offer.driver_name,
      offer.driver_phone,
      offer.truck_number,
      offer.trailer_number
    ];
    
    // Check if at least 3 out of 4 required fields are filled
    const filledFields = requiredFields.filter(field => field && field.trim() !== '').length;
    return filledFields >= 3;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Driver Information - {isBid ? 'Bid' : 'Load'} #{isBid ? offer.bid_number : offer.load_rr_number}
          </DialogTitle>
          <DialogDescription>
            Driver details submitted by carrier for this {isBid ? 'awarded bid' : 'accepted offer'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Load/Bid Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                {isBid ? 'Bid' : 'Load'} Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Route</p>
                  <p className="font-medium">
                    {isBid ? (
                      offer.stops && Array.isArray(offer.stops) && offer.stops.length > 0 ? (
                        `${offer.stops[0]} → ${offer.stops[offer.stops.length - 1]}`
                      ) : 'Route not available'
                    ) : (
                      `${offer.origin_city}, ${offer.origin_state} → ${offer.destination_city}, ${offer.destination_state}`
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">State Tag</p>
                  <p className="font-medium">{offer.equipment_type || offer.equipment || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pickup Date</p>
                  <p className="font-medium">{formatDate(isBid ? offer.pickup_timestamp : offer.pickup_date)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Delivery Date</p>
                  <p className="font-medium">{formatDate(isBid ? offer.delivery_timestamp : offer.delivery_date)}</p>
                </div>
                {isBid && offer.miles && (
                  <div>
                    <p className="text-sm text-muted-foreground">Miles</p>
                    <p className="font-medium">{offer.miles.toLocaleString()}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Driver Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Driver Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Driver Name</p>
                  <p className="font-medium">{offer.driver_name || 'Not provided'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Phone Number</p>
                  <p className="font-medium">{offer.driver_phone || 'Not provided'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email Address</p>
                  <p className="font-medium">{offer.driver_email || 'Not provided'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">License Number</p>
                  <p className="font-medium">{offer.driver_license_number || 'Not provided'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">License State</p>
                  <p className="font-medium">{offer.driver_license_state || 'Not provided'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Carrier Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Carrier Contact
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Carrier Name</p>
                  <p className="font-medium">{offer.carrier_name || 'Not provided'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Carrier Email</p>
                  <p className="font-medium">{offer.carrier_email || 'Not provided'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Carrier Phone</p>
                  <p className="font-medium">{offer.carrier_phone || 'Not provided'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Vehicle Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-4 w-4" />
                Vehicle Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Truck Number</p>
                  <p className="font-medium">{offer.truck_number || 'Not provided'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Trailer Number</p>
                  <p className="font-medium">{offer.trailer_number || 'Not provided'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Submission Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Submission Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Submitted At</p>
                  <p className="font-medium">{formatDateTime(offer.driver_info_submitted_at)}</p>
                </div>
                <Badge 
                  variant="outline" 
                  className={isDriverInfoComplete() 
                    ? "bg-green-50 text-green-700 border-green-200" 
                    : "bg-yellow-50 text-yellow-700 border-yellow-200"
                  }
                >
                  {isDriverInfoComplete() ? 'Information Complete' : 'Information Incomplete'}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
            <Button
              onClick={() => {
                // TODO: Add functionality to contact driver or carrier
                console.log('Contact driver/carrier functionality to be implemented');
              }}
            >
              Contact Driver
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
