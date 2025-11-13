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
  FileText,
  MapPin,
  MessageSquare,
  Package,
  Truck
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BidLifecycleManager } from "./BidLifecycleManager";

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
  const [showLifecycleManager, setShowLifecycleManager] = useState(false);
  const [acceptingBid, setAcceptingBid] = useState(false);

  // Fetch bid history when dialog opens
  useEffect(() => {
    if (isOpen && bid?.bid_number) {
      setHistoryLoading(true);
      fetch(`/api/carrier/bids/history?bidNumber=${bid.bid_number}`)
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

  if (!bid) return null;

  const getStatusBadge = (status: string) => {
    const variants = {
      awarded: "bg-blue-500/20 text-blue-300 border-blue-400",
      accepted: "bg-green-500/20 text-green-300 border-green-400",
      in_progress: "bg-orange-500/20 text-orange-300 border-orange-400",
      completed: "bg-gray-500/20 text-gray-300 border-gray-400",
      cancelled: "bg-red-500/20 text-red-300 border-red-400"
    };
    
    // Show "Awaiting Acceptance" for awarded status
    const displayStatus = status === 'awarded' ? 'Awaiting Acceptance' : status.replace('_', ' ').toUpperCase();
    
    return (
      <Badge variant="outline" className={variants[status as keyof typeof variants] || variants.awarded}>
        {displayStatus}
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
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="lifecycle">Lifecycle</TabsTrigger>
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
                    <p className="text-lg font-semibold">{bid.awarded_by_name || bid.awarded_by}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Awarded At</Label>
                    <p className="text-lg font-semibold">
                      {new Date(bid.awarded_at).toLocaleString()}
                    </p>
                  </div>
                  {bid.source_channel && bid.source_channel !== '-1002560784901' && (
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Source Channel</Label>
                      <p className="text-lg font-semibold">{bid.source_channel}</p>
                    </div>
                  )}
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
            {/* Only show lifecycle if bid has been accepted (status !== 'awarded') */}
            {bid.status !== 'awarded' ? (
              <BidLifecycleManager 
                bidId={bid.bid_number} 
                bidData={bid}
              />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Truck className="w-5 h-5" />
                    Bid Lifecycle
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="mb-4">Please accept this bid first to access the lifecycle.</p>
                    <Button
                      onClick={async () => {
                        setAcceptingBid(true);
                        try {
                          const response = await fetch(`/api/carrier/bid-lifecycle/${bid.bid_number}`, {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                              status: 'bid_awarded',
                              notes: 'Bid accepted by carrier'
                            }),
                          });

                          if (response.ok) {
                            toast.success('Bid accepted successfully! You can now access the lifecycle.');
                            setIsOpen(false);
                            // Refresh the page or update bid status
                            window.location.reload();
                          } else {
                            const errorData = await response.json();
                            toast.error(`Failed to accept bid: ${errorData.error || 'Unknown error'}`);
                          }
                        } catch (error) {
                          toast.error('Failed to accept bid. Please try again.');
                        } finally {
                          setAcceptingBid(false);
                        }
                      }}
                      disabled={acceptingBid}
                    >
                      <Truck className="w-4 h-4 mr-2" />
                      {acceptingBid ? 'Accepting...' : 'Accept Bid'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Close
          </Button>
          {/* Only show Update Status if bid has been accepted */}
          {bid.status !== 'awarded' && (
            <Button onClick={() => setShowLifecycleManager(true)}>
              <Truck className="h-4 w-4 mr-2" />
              Update Status
            </Button>
          )}
          <Button variant="outline">
            <MessageSquare className="h-4 w-4 mr-2" />
            Message
          </Button>
        </div>
        
        {/* Update Status Dialog - Opens BidLifecycleManager */}
        {showLifecycleManager && (
          <Dialog open={showLifecycleManager} onOpenChange={setShowLifecycleManager}>
            <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Truck className="w-5 h-5" />
                  Update Bid Status - #{bid.bid_number}
                </DialogTitle>
              </DialogHeader>
              <BidLifecycleManager 
                bidId={bid.bid_number} 
                bidData={bid}
              />
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
}