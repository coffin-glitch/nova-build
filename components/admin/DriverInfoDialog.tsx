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
    id: number;
    load_rr_number: string;
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
    equipment?: string;
    carrier_email?: string;
  } | null;
}

export function DriverInfoDialog({ open, onOpenChange, offer }: DriverInfoDialogProps) {
  if (!offer) return null;

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Driver Information - Load #{offer.load_rr_number}
          </DialogTitle>
          <DialogDescription>
            Driver details submitted by carrier for this accepted offer
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Load Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Load Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Route</p>
                  <p className="font-medium">
                    {offer.origin_city}, {offer.origin_state} → {offer.destination_city}, {offer.destination_state}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Equipment</p>
                  <p className="font-medium">{offer.equipment || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pickup Date</p>
                  <p className="font-medium">{formatDate(offer.pickup_date)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Delivery Date</p>
                  <p className="font-medium">{formatDate(offer.delivery_date)}</p>
                </div>
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
                <div>
                  <p className="text-sm text-muted-foreground">Carrier Email</p>
                  <p className="font-medium">{offer.carrier_email || 'Not provided'}</p>
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
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  Information Complete
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
