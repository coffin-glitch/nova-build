"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDistance, formatMoney } from "@/lib/format";
import {
    ArrowLeft,
    CheckCircle2,
    Clock,
    FileText,
    MapPin,
    MessageSquare,
    Package,
    Truck
} from "lucide-react";
import { useEffect, useState } from "react";

interface BidDetailsDialogProps {
  bid?: any;
  children?: React.ReactNode;
}

interface BidHistoryEntry {
  id: string;
  bid_id: string;
  action: string;
  old_status?: string;
  new_status?: string;
  old_amount?: number;
  new_amount?: number;
  admin_notes?: string;
  carrier_notes?: string;
  performed_by: string;
  performed_at: string;
}

export function BidDetailsDialog({ bid, children }: BidDetailsDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messageConsoleOpen, setMessageConsoleOpen] = useState(false);
  const [bidHistory, setBidHistory] = useState<BidHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  if (!bid) return null;

  // Fetch bid history when dialog opens
  useEffect(() => {
    if (isOpen && bid?.bid_number) {
      setHistoryLoading(true);
      fetch(`/api/carrier/bids/${bid.bid_number}/history`)
        .then(res => res.json())
        .then(data => {
          if (data.ok) {
            setBidHistory(data.history || []);
          }
        })
        .catch(error => {
          console.error('Error fetching bid history:', error);
        })
        .finally(() => {
          setHistoryLoading(false);
        });
    }
  }, [isOpen, bid?.bid_number]);

  const getStatusBadge = (status: string) => {
    const variants = {
      awarded: "bg-blue-500/20 text-blue-300 border-blue-400",
      accepted: "bg-green-500/20 text-green-300 border-green-400",
      in_progress: "bg-orange-500/20 text-orange-300 border-orange-400",
      completed: "bg-gray-500/20 text-gray-300 border-gray-400",
      cancelled: "bg-red-500/20 text-red-300 border-red-400"
    };
    
    return (
      <Badge variant="outline" className={variants[status as keyof typeof variants] || variants.awarded}>
        {status.replace('_', ' ').toUpperCase()}
      </Badge>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm">
            <FileText className="w-4 h-4 mr-2" />
            View Details
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Bid Details - #{bid.bid_number}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="lifecycle">Lifecycle</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Status and Basic Info */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {getStatusBadge(bid.status || 'awarded')}
                <div>
                  <h3 className="text-lg font-semibold">Bid #{bid.bid_number}</h3>
                  <p className="text-sm text-muted-foreground">
                    Awarded: {new Date(bid.awarded_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold">{formatMoney(bid.winner_amount_cents)}</div>
                <div className="text-sm text-muted-foreground">Winning Amount</div>
              </div>
            </div>

            {/* Route Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Route Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Distance</Label>
                    <p className="text-lg font-semibold">
                      {bid.distance_miles ? formatDistance(bid.distance_miles) : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">State Tag</Label>
                    <p className="text-lg font-semibold">{bid.tag || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Pickup Date</Label>
                    <p className="text-lg font-semibold">
                      {bid.pickup_timestamp ? new Date(bid.pickup_timestamp).toLocaleString() : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Delivery Date</Label>
                    <p className="text-lg font-semibold">
                      {bid.delivery_timestamp ? new Date(bid.delivery_timestamp).toLocaleString() : 'N/A'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Stops Information */}
            {bid.stops && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Truck className="w-5 h-5" />
                    Route Details
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{JSON.stringify(bid.stops)}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Award Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5" />
                  Award Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Awarded By</Label>
                    <p className="text-lg font-semibold">{bid.awarded_by}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Awarded At</Label>
                    <p className="text-lg font-semibold">
                      {new Date(bid.awarded_at).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Source Channel</Label>
                    <p className="text-lg font-semibold">{bid.source_channel || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Last Updated</Label>
                    <p className="text-lg font-semibold">
                      {bid.updated_at ? new Date(bid.updated_at).toLocaleString() : 'N/A'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Notes */}
            {bid.notes && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Notes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{bid.notes}</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="lifecycle" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="w-5 h-5" />
                  Bid Lifecycle
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  Lifecycle management will be available here
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Bid History
                </CardTitle>
              </CardHeader>
              <CardContent>
                {historyLoading ? (
                  <div className="text-center py-8">
                    <Clock className="w-8 h-8 animate-spin mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">Loading history...</p>
                  </div>
                ) : bidHistory.length > 0 ? (
                  <div className="space-y-4">
                    {bidHistory.map((entry) => (
                      <div key={entry.id} className="flex items-start gap-4 p-4 border rounded-lg">
                        <div className="flex-shrink-0">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                            <Clock className="w-4 h-4 text-blue-600" />
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">{entry.action}</span>
                            <span className="text-sm text-muted-foreground">
                              by {entry.performed_by}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            {new Date(entry.performed_at).toLocaleString()}
                          </p>
                          {entry.carrier_notes && (
                            <p className="text-sm bg-muted p-2 rounded">
                              <strong>Notes:</strong> {entry.carrier_notes}
                            </p>
                          )}
                          {entry.admin_notes && (
                            <p className="text-sm bg-blue-50 p-2 rounded">
                              <strong>Admin Notes:</strong> {entry.admin_notes}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No history available for this bid</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Close
          </Button>
          <Button>
            <Truck className="h-4 w-4 mr-2" />
            Update Status
          </Button>
          <Button variant="outline">
            <MessageSquare className="h-4 w-4 mr-2" />
            Message
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}