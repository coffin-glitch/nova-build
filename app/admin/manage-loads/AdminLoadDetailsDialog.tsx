"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, formatDate, formatDistance } from "@/lib/utils";
import {
    CheckCircle2,
    Clock,
    DollarSign,
    FileText,
    MapPin,
    Package,
    Truck,
    User
} from "lucide-react";
import { useEffect, useState } from "react";

interface Load {
  rr_number: string;
  tm_number?: string;
  status_code: string;
  pickup_date?: string;
  pickup_time?: string;
  delivery_date?: string;
  delivery_time?: string;
  target_buy: number;
  equipment: string;
  weight: number;
  miles: number;
  stops: number;
  customer_name: string;
  origin_city: string;
  origin_state: string;
  destination_city: string;
  destination_state: string;
  updated_at: string;
  published: boolean;
  revenue?: number;
  purchase?: number;
  net?: number;
  margin?: number;
  load_number?: string;
  max_buy?: number;
  spot_bid?: string;
  fuel_surcharge?: number;
  docs_scanned?: string;
  invoice_date?: string;
  invoice_audit?: string;
  purch_tr?: number;
  net_mrg?: number;
  cm?: number;
  nbr_of_stops?: number;
  vendor_dispatch?: string;
  customer_ref?: string;
  driver_name?: string;
  dispatcher_name?: string;
  vendor_name?: string;
}

interface AdminLoadDetailsDialogProps {
  load: Load;
  isOpen: boolean;
  onClose: () => void;
}

export function AdminLoadDetailsDialog({ load, isOpen, onClose }: AdminLoadDetailsDialogProps) {
  const [loadDetails, setLoadDetails] = useState<Load | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch detailed load information when dialog opens
  useEffect(() => {
    if (isOpen && load.rr_number) {
      setLoading(true);
      fetch(`/api/admin/loads/${load.rr_number}`)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setLoadDetails(data.load);
          }
        })
        .catch(error => {
          console.error('Error fetching load details:', error);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [isOpen, load.rr_number]);

  // Normalize status code - convert ASSG to active
  const normalizeStatus = (status: string) => {
    if (status === 'ASSG') return 'active';
    return status.toLowerCase();
  };

  const getStatusBadge = (status: string, published: boolean) => {
    const normalizedStatus = normalizeStatus(status);
    
    // Handle unpublished loads
    if (!published) {
      return { variant: 'secondary' as const, label: 'Unpublished' };
    }
    
    switch (normalizedStatus) {
      case 'active': return { variant: 'default' as const, label: 'Active' };
      case 'published': return { variant: 'default' as const, label: 'Published' };
      case 'completed': return { variant: 'secondary' as const, label: 'Completed' };
      case 'cancelled': return { variant: 'destructive' as const, label: 'Cancelled' };
      case 'archived': return { variant: 'outline' as const, label: 'Archived' };
      case 'draft': return { variant: 'secondary' as const, label: 'Draft' };
      default: return { variant: 'secondary' as const, label: normalizedStatus };
    }
  };

  const getEquipmentIcon = (equipment: string) => {
    const eq = equipment.toLowerCase();
    if (eq.includes('reefer')) return '❄️';
    if (eq.includes('flatbed') || eq.includes('flat bed')) return '🚛';
    if (eq.includes('container')) return '📦';
    return '🚚'; // Default to dry van
  };

  const displayLoad = loadDetails || load;
  const statusBadge = getStatusBadge(displayLoad.status_code, displayLoad.published);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>Load #{displayLoad.rr_number}</span>
            <Badge variant={statusBadge.variant}>
              {statusBadge.label}
            </Badge>
            {displayLoad.load_number && (
              <span className="text-sm text-muted-foreground">
                (Load #{displayLoad.load_number})
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="financial">Financial</TabsTrigger>
              <TabsTrigger value="route">Route Details</TabsTrigger>
              <TabsTrigger value="admin">Admin Info</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Load Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Load Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Equipment:</span>
                      <span className="font-medium">{displayLoad.equipment}</span>
                      <span>{getEquipmentIcon(displayLoad.equipment)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Distance:</span>
                      <span className="font-medium">{formatDistance(displayLoad.miles)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Weight:</span>
                      <span className="font-medium">{displayLoad.weight.toLocaleString()} lbs</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Truck className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Stops:</span>
                      <span className="font-medium">{displayLoad.stops}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Customer Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Customer Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Customer:</span>
                      <span className="font-medium">{displayLoad.customer_name}</span>
                    </div>
                    {displayLoad.customer_ref && (
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Reference:</span>
                        <span className="font-medium">{displayLoad.customer_ref}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="financial" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Revenue Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-green-500" />
                      <span className="text-sm text-muted-foreground">Revenue:</span>
                      <span className="font-medium text-green-500">{formatCurrency(displayLoad.revenue || 0)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-blue-500" />
                      <span className="text-sm text-muted-foreground">Target Buy:</span>
                      <span className="font-medium text-blue-500">{formatCurrency(displayLoad.target_buy)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-purple-500" />
                      <span className="text-sm text-muted-foreground">Max Buy:</span>
                      <span className="font-medium text-purple-500">{formatCurrency(displayLoad.max_buy || 0)}</span>
                    </div>
                    {displayLoad.spot_bid && (
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-orange-500" />
                        <span className="text-sm text-muted-foreground">Spot Bid:</span>
                        <span className="font-medium text-orange-500">{displayLoad.spot_bid}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Profit Analysis</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Purchase:</span>
                      <span className="font-medium">{formatCurrency(displayLoad.purchase || 0)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-green-500" />
                      <span className="text-sm text-muted-foreground">Net:</span>
                      <span className="font-medium text-green-500">{formatCurrency(displayLoad.net || 0)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-blue-500" />
                      <span className="text-sm text-muted-foreground">Margin:</span>
                      <span className="font-medium text-blue-500">{formatCurrency(displayLoad.margin || 0)}</span>
                    </div>
                    {displayLoad.fuel_surcharge && (
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-yellow-500" />
                        <span className="text-sm text-muted-foreground">Fuel Surcharge:</span>
                        <span className="font-medium text-yellow-500">{formatCurrency(displayLoad.fuel_surcharge)}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="route" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Route Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-blue-500" />
                        Pickup Location
                      </h4>
                      <div className="space-y-2">
                        <p className="font-medium">{displayLoad.origin_city}, {displayLoad.origin_state}</p>
                        <p className="text-sm text-muted-foreground">
                          Date: {displayLoad.pickup_date || 'N/A'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Time: {displayLoad.pickup_time || 'N/A'}
                        </p>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-green-500" />
                        Delivery Location
                      </h4>
                      <div className="space-y-2">
                        <p className="font-medium">{displayLoad.destination_city}, {displayLoad.destination_state}</p>
                        <p className="text-sm text-muted-foreground">
                          Date: {displayLoad.delivery_date || 'N/A'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Time: {displayLoad.delivery_time || 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Truck className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Total Distance</span>
                      </div>
                      <span className="font-semibold">{formatDistance(displayLoad.miles)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="admin" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Dispatch Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {displayLoad.dispatcher_name && (
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Dispatcher:</span>
                        <span className="font-medium">{displayLoad.dispatcher_name}</span>
                      </div>
                    )}
                    {displayLoad.driver_name && (
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Driver:</span>
                        <span className="font-medium">{displayLoad.driver_name}</span>
                      </div>
                    )}
                    {displayLoad.vendor_name && (
                      <div className="flex items-center gap-2">
                        <Truck className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Vendor:</span>
                        <span className="font-medium">{displayLoad.vendor_name}</span>
                      </div>
                    )}
                    {displayLoad.vendor_dispatch && (
                      <div className="flex items-center gap-2">
                        <Truck className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Vendor Dispatch:</span>
                        <span className="font-medium">{displayLoad.vendor_dispatch}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">System Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Last Updated:</span>
                      <span className="font-medium">{formatDate(displayLoad.updated_at)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Published:</span>
                      <Badge variant={displayLoad.published ? 'default' : 'secondary'}>
                        {displayLoad.published ? 'Yes' : 'No'}
                      </Badge>
                    </div>
                    {displayLoad.tm_number && (
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">TM Number:</span>
                        <span className="font-medium">{displayLoad.tm_number}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
